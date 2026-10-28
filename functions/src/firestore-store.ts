/*
 * Limits and counters in Firestore, written only by the function through the Admin SDK (the
 * security rules deny all client access to these collections):
 *
 *   assistantConfig/runtime        { enabled, disabledReason, updatedAt }  kill switch
 *   assistantUsage/{YYYY-MM-DD}    { calls, outcomes.*, tokens.*, costMicros }
 *   assistantUsage/{YYYY-MM}       { costMicros }
 *   assistantRate/{clientKey}      { minuteWindow, minuteCount, day, dayCount, expireAt }  (TTL on expireAt)
 */
import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import {
  ClientUsage, costMicros, dayKey, DayUsage, LimitConfig, LimitStore, monthKey, MonthUsage, Outcome, Reservation, reserve, Usage
} from "./core/limits";

export const CONFIG_DOC = "assistantConfig/runtime";
const SWITCH_CACHE_MS = 30_000;
const RATE_TTL_MS = 48 * 60 * 60 * 1000;

export class FirestoreLimitStore implements LimitStore {
  private switchCache?: { readonly value: boolean; readonly at: number };

  constructor(private readonly db: Firestore, private readonly config: LimitConfig) {}

  async enabled(): Promise<boolean> {
    const now = Date.now();
    if (this.switchCache && now - this.switchCache.at < SWITCH_CACHE_MS) {
      return this.switchCache.value;
    }
    const snapshot = await this.db.doc(CONFIG_DOC).get();
    const value = snapshot.get("enabled") === true;
    this.switchCache = { value, at: now };
    return value;
  }

  async reserve(clientKey: string, now: Date): Promise<Reservation> {
    const dayRef = this.db.doc(`assistantUsage/${dayKey(now)}`);
    const monthRef = this.db.doc(`assistantUsage/${monthKey(now)}`);
    const clientRef = this.db.doc(`assistantRate/${clientKey}`);
    return this.db.runTransaction(async tx => {
      const [day, month, client] = await tx.getAll(dayRef, monthRef, clientRef);
      const result = reserve(this.config, now,
        day.exists ? { calls: day.get("calls") ?? 0 } as DayUsage : undefined,
        month.exists ? { costMicros: month.get("costMicros") ?? 0 } as MonthUsage : undefined,
        client.exists ? client.data() as ClientUsage : undefined);
      if (result.allowed) {
        tx.set(dayRef, { calls: result.day!.calls }, { merge: true });
        tx.set(clientRef, { ...result.client!, expireAt: Timestamp.fromMillis(now.getTime() + RATE_TTL_MS) });
      }
      return result;
    });
  }

  async record(now: Date, outcome: Outcome, usage?: Usage): Promise<void> {
    const batch = this.db.batch();
    const day: Record<string, unknown> = { [`outcomes.${outcome}`]: FieldValue.increment(1) };
    if (usage) {
      const cost = costMicros(usage);
      Object.assign(day, {
        "tokens.input": FieldValue.increment(usage.inputTokens),
        "tokens.cacheRead": FieldValue.increment(usage.cacheReadTokens),
        "tokens.cacheWrite": FieldValue.increment(usage.cacheWriteTokens),
        "tokens.output": FieldValue.increment(usage.outputTokens),
        costMicros: FieldValue.increment(cost)
      });
      batch.set(this.db.doc(`assistantUsage/${monthKey(now)}`), { costMicros: FieldValue.increment(cost) }, { merge: true });
    }
    // update() with dotted paths needs the document to exist; set+merge with nested objects does not.
    batch.set(this.db.doc(`assistantUsage/${dayKey(now)}`), expand(day), { merge: true });
    await batch.commit();
  }
}

/** Turns { "a.b": v } into { a: { b: v } } for set(..., { merge: true }). */
function expand(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, any> = {};
  for (const [path, value] of Object.entries(fields)) {
    const keys = path.split(".");
    let target = result;
    keys.slice(0, -1).forEach(key => (target = target[key] ??= {}));
    target[keys[keys.length - 1]] = value;
  }
  return result;
}
