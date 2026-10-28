/*
 * Daily, monthly and per-visitor limits for hosted answers. The decision is a pure function of
 * the stored counters, so the Firestore store (one transaction per request) and the in-memory
 * store used by tests apply exactly the same rules.
 *
 * The monthly cap is enforced before a call is paid for: a reservation adds the call's cost
 * ceiling to the month in the same atomic step as the call counters, and settling later
 * replaces it with the actual cost. When the actual cost is unknown (a timeout, a failed
 * settlement), the reservation stays, so the cap fails closed.
 */
import { createHmac } from "node:crypto";
import { LimitName, Outcome } from "./constants";
import type { CostPolicy, Usage } from "./pricing";

export interface LimitConfig {
  /** Model calls per UTC day, for everyone. */
  readonly dailyCalls: number;
  readonly perClientPerMinute: number;
  readonly perClientPerDay: number;
  /** Model spend per UTC month, reserved and actual, in millionths of a dollar. */
  readonly monthlyBudgetMicros: number;
}

export interface DayUsage {
  readonly calls: number;
}

export interface MonthUsage {
  readonly costMicros: number;
}

export interface ClientUsage {
  /** Start of the current one-minute window, in ms since the epoch. */
  readonly minuteWindow: number;
  readonly minuteCount: number;
  /** "YYYY-MM-DD" (UTC). */
  readonly day: string;
  readonly dayCount: number;
}

export interface Reservation {
  readonly allowed: boolean;
  /** Which limit refused the call. */
  readonly limit?: LimitName;
  /** Counters to write when allowed. */
  readonly day?: DayUsage;
  readonly month?: MonthUsage;
  readonly client?: ClientUsage;
  /** The cost ceiling added to the month; settled against the actual cost later. */
  readonly reservedMicros: number;
}

/** What to settle after a reserved call: the actual usage, or nothing when it's unknown. */
export interface Settlement {
  readonly reservedMicros: number;
  readonly usage?: Usage;
}

export const dayKey = (now: Date): string => now.toISOString().slice(0, 10);
export const monthKey = (now: Date): string => now.toISOString().slice(0, 7);

/** Decides whether one more model call, costing at most `reservationMicros`, fits, and the counters after it. */
export function reserve(config: LimitConfig, now: Date, reservationMicros: number, day: DayUsage | undefined,
                        month: MonthUsage | undefined, client: ClientUsage | undefined): Reservation {
  const refused = (limit: LimitName): Reservation => ({ allowed: false, limit, reservedMicros: 0 });
  const today = dayKey(now);
  const minuteWindow = Math.floor(now.getTime() / 60_000) * 60_000;
  const calls = day?.calls ?? 0;
  const spent = month?.costMicros ?? 0;
  if (calls >= config.dailyCalls) {
    return refused(LimitName.Daily);
  }
  if (spent + reservationMicros > config.monthlyBudgetMicros) {
    return refused(LimitName.Monthly);
  }
  const minuteCount = client && client.minuteWindow === minuteWindow ? client.minuteCount : 0;
  const dayCount = client && client.day === today ? client.dayCount : 0;
  if (minuteCount >= config.perClientPerMinute) {
    return refused(LimitName.ClientMinute);
  }
  if (dayCount >= config.perClientPerDay) {
    return refused(LimitName.ClientDay);
  }
  return {
    allowed: true,
    day: { calls: calls + 1 },
    month: { costMicros: spent + reservationMicros },
    client: { minuteWindow, minuteCount: minuteCount + 1, day: today, dayCount: dayCount + 1 },
    reservedMicros: reservationMicros
  };
}

/** How much to add to the month when settling: the actual cost minus the reservation, or nothing when usage is unknown. */
export function settlementDelta(costs: CostPolicy, settlement: Settlement | undefined): number {
  return settlement?.usage ? costs.cost(settlement.usage) - settlement.reservedMicros : 0;
}

/**
 * A key for per-visitor limits that can't be turned back into the IP address and changes every
 * UTC day. The salt is a secret, so the key can't be recomputed from a guessed IP either.
 */
export function clientKey(salt: string, ip: string, now: Date): string {
  return createHmac("sha256", salt).update(`${ip}|${dayKey(now)}`).digest("hex").slice(0, 32);
}

export interface LimitStore {
  /** Whether the kill switch allows hosted answers. A missing switch means off. */
  enabled(): Promise<boolean>;
  /** Reserves one model call and its cost ceiling (all counters in one atomic step). Throws if the store is unavailable. */
  reserve(clientKey: string, now: Date, reservationMicros: number): Promise<Reservation>;
  /** Counts an outcome and settles a reservation; best effort, but the monthly cap never loses a reservation. */
  record(now: Date, outcome: Outcome, settlement?: Settlement): Promise<void>;
}

/** The in-process store used by tests. */
export class MemoryLimitStore implements LimitStore {
  readonly days = new Map<string, DayUsage & { outcomes: Partial<Record<Outcome, number>> }>();
  readonly months = new Map<string, MonthUsage>();
  readonly clients = new Map<string, ClientUsage>();

  constructor(private readonly config: LimitConfig, private readonly costs: CostPolicy, public switchOn = true) {}

  async enabled(): Promise<boolean> {
    return this.switchOn;
  }

  async reserve(key: string, now: Date, reservationMicros: number): Promise<Reservation> {
    const result = reserve(this.config, now, reservationMicros, this.days.get(dayKey(now)), this.months.get(monthKey(now)), this.clients.get(key));
    if (result.allowed) {
      const outcomes = this.days.get(dayKey(now))?.outcomes ?? {};
      this.days.set(dayKey(now), { ...result.day!, outcomes });
      this.months.set(monthKey(now), result.month!);
      this.clients.set(key, result.client!);
    }
    return result;
  }

  async record(now: Date, outcome: Outcome, settlement?: Settlement): Promise<void> {
    const day = this.days.get(dayKey(now)) ?? { calls: 0, outcomes: {} };
    this.days.set(dayKey(now), { ...day, outcomes: { ...day.outcomes, [outcome]: (day.outcomes[outcome] ?? 0) + 1 } });
    const delta = settlementDelta(this.costs, settlement);
    if (delta) {
      const month = this.months.get(monthKey(now)) ?? { costMicros: 0 };
      this.months.set(monthKey(now), { costMicros: month.costMicros + delta });
    }
  }
}
