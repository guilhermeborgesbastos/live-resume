/*
 * Daily, monthly and per-visitor limits for hosted answers. The decision is a pure function of
 * the stored counters, so the Firestore store (one transaction per request) and the in-memory
 * store used by tests apply exactly the same rules.
 */
import { createHmac } from "node:crypto";

export interface LimitConfig {
  /** Model calls per UTC day, for everyone. */
  readonly dailyCalls: number;
  readonly perClientPerMinute: number;
  readonly perClientPerDay: number;
  /** Estimated model spend per UTC month, in millionths of a dollar. */
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
  /** Which limit refused the call, for the counters. */
  readonly limit?: "daily" | "monthly" | "client-minute" | "client-day";
  /** Counters to write when allowed. */
  readonly day?: DayUsage;
  readonly client?: ClientUsage;
}

export const dayKey = (now: Date): string => now.toISOString().slice(0, 10);
export const monthKey = (now: Date): string => now.toISOString().slice(0, 7);

/** Decides whether one more model call fits, and the counters after it. */
export function reserve(config: LimitConfig, now: Date, day: DayUsage | undefined, month: MonthUsage | undefined,
                        client: ClientUsage | undefined): Reservation {
  const today = dayKey(now);
  const minuteWindow = Math.floor(now.getTime() / 60_000) * 60_000;
  const calls = day?.calls ?? 0;
  if (calls >= config.dailyCalls) {
    return { allowed: false, limit: "daily" };
  }
  if ((month?.costMicros ?? 0) >= config.monthlyBudgetMicros) {
    return { allowed: false, limit: "monthly" };
  }
  const minuteCount = client && client.minuteWindow === minuteWindow ? client.minuteCount : 0;
  const dayCount = client && client.day === today ? client.dayCount : 0;
  if (minuteCount >= config.perClientPerMinute) {
    return { allowed: false, limit: "client-minute" };
  }
  if (dayCount >= config.perClientPerDay) {
    return { allowed: false, limit: "client-day" };
  }
  return {
    allowed: true,
    day: { calls: calls + 1 },
    client: { minuteWindow, minuteCount: minuteCount + 1, day: today, dayCount: dayCount + 1 }
  };
}

/**
 * A key for per-visitor limits that can't be turned back into the IP address and changes every
 * UTC day. The salt is a secret, so the key can't be recomputed from a guessed IP either.
 */
export function clientKey(salt: string, ip: string, now: Date): string {
  return createHmac("sha256", salt).update(`${ip}|${dayKey(now)}`).digest("hex").slice(0, 32);
}

export type Outcome = "answered" | "unsupported" | "invalid" | "error" | "limited";

export interface Usage {
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
}

export interface LimitStore {
  /** Whether the kill switch allows hosted answers. A missing switch means off. */
  enabled(): Promise<boolean>;
  /** Reserves one model call (all counters in one atomic step). Throws if the store is unavailable. */
  reserve(clientKey: string, now: Date): Promise<Reservation>;
  /** Adds an outcome and, for model calls, the usage and estimated cost. Never fails the request. */
  record(now: Date, outcome: Outcome, usage?: Usage): Promise<void>;
}

/** Claude Haiku 5.5 on the Vertex AI `eu` multi-region, in millionths of a dollar per token. Recheck in the console. */
export const PRICE_MICROS_PER_TOKEN = {
  input: 0.11,
  cacheWrite: 0.1375,
  cacheRead: 0.011,
  output: 0.55
} as const;

export function costMicros(usage: Usage): number {
  const p = PRICE_MICROS_PER_TOKEN;
  return Math.ceil(usage.inputTokens * p.input + usage.cacheWriteTokens * p.cacheWrite
    + usage.cacheReadTokens * p.cacheRead + usage.outputTokens * p.output);
}

/** The in-process store used by tests and the emulator smoke run. */
export class MemoryLimitStore implements LimitStore {
  readonly days = new Map<string, DayUsage & { outcomes: Partial<Record<Outcome, number>> }>();
  readonly months = new Map<string, MonthUsage>();
  readonly clients = new Map<string, ClientUsage>();

  constructor(private readonly config: LimitConfig, public switchOn = true) {}

  async enabled(): Promise<boolean> {
    return this.switchOn;
  }

  async reserve(key: string, now: Date): Promise<Reservation> {
    const result = reserve(this.config, now, this.days.get(dayKey(now)), this.months.get(monthKey(now)), this.clients.get(key));
    if (result.allowed) {
      const outcomes = this.days.get(dayKey(now))?.outcomes ?? {};
      this.days.set(dayKey(now), { ...result.day!, outcomes });
      this.clients.set(key, result.client!);
    }
    return result;
  }

  async record(now: Date, outcome: Outcome, usage?: Usage): Promise<void> {
    const day = this.days.get(dayKey(now)) ?? { calls: 0, outcomes: {} };
    this.days.set(dayKey(now), { ...day, outcomes: { ...day.outcomes, [outcome]: (day.outcomes[outcome] ?? 0) + 1 } });
    if (usage) {
      const month = this.months.get(monthKey(now)) ?? { costMicros: 0 };
      this.months.set(monthKey(now), { costMicros: month.costMicros + costMicros(usage) });
    }
  }
}
