/*
 * Limits and counters in Firestore, written only by the function through the Admin SDK (the
 * security rules deny all client access to these collections):
 *
 *   assistantConfig/runtime        { enabled, disabledReason, updatedAt }  kill switch
 *   assistantUsage/{YYYY-MM-DD}    { calls, outcomes.*, tokens.* }
 *   assistantUsage/{YYYY-MM}       { costMicros }  reserved before each call, settled after it
 *   assistantRate/{clientKey}      { minuteWindow, minuteCount, day, dayCount, expireAt }  (TTL on expireAt)
 */
import { FieldValue, Firestore, Timestamp } from "firebase-admin/firestore";
import { FirestoreField, FirestorePath, Outcome } from "./core/constants";
import {
  ClientUsage, dayKey, LimitConfig, LimitStore, monthKey, Reservation, reserve, Settlement, settlementDelta
} from "./core/limits";
import type { CostPolicy } from "./core/pricing";

const SWITCH_CACHE_MS = 30_000;
const RATE_TTL_MS = 48 * 60 * 60 * 1000;

export class FirestoreLimitStore implements LimitStore {
  private switchCache?: { readonly value: boolean; readonly at: number };

  constructor(private readonly db: Firestore, private readonly config: LimitConfig, private readonly costs: CostPolicy) {}

  async enabled(): Promise<boolean> {
    const now = Date.now();
    if (this.switchCache && now - this.switchCache.at < SWITCH_CACHE_MS) {
      return this.switchCache.value;
    }
    const snapshot = await this.db.doc(FirestorePath.RuntimeConfig).get();
    const value = snapshot.get(FirestoreField.Enabled) === true;
    this.switchCache = { value, at: now };
    return value;
  }

  async reserve(clientKey: string, now: Date, reservationMicros: number): Promise<Reservation> {
    const dayRef = this.db.doc(`${FirestorePath.Usage}/${dayKey(now)}`);
    const monthRef = this.db.doc(`${FirestorePath.Usage}/${monthKey(now)}`);
    const clientRef = this.db.doc(`${FirestorePath.Rate}/${clientKey}`);
    return this.db.runTransaction(async tx => {
      const [day, month, client] = await tx.getAll(dayRef, monthRef, clientRef);
      const result = reserve(this.config, now, reservationMicros,
        day.exists ? { calls: day.get(FirestoreField.Calls) ?? 0 } : undefined,
        month.exists ? { costMicros: month.get(FirestoreField.CostMicros) ?? 0 } : undefined,
        client.exists ? client.data() as ClientUsage : undefined);
      if (result.allowed) {
        tx.set(dayRef, { [FirestoreField.Calls]: result.day!.calls }, { merge: true });
        tx.set(monthRef, { [FirestoreField.CostMicros]: result.month!.costMicros }, { merge: true });
        tx.set(clientRef, { ...result.client!, expireAt: Timestamp.fromMillis(now.getTime() + RATE_TTL_MS) });
      }
      return result;
    });
  }

  async record(now: Date, outcome: Outcome, settlement?: Settlement): Promise<void> {
    const batch = this.db.batch();
    const usage = settlement?.usage;
    batch.set(this.db.doc(`${FirestorePath.Usage}/${dayKey(now)}`), {
      outcomes: { [outcome]: FieldValue.increment(1) },
      ...(usage ? {
        tokens: {
          input: FieldValue.increment(usage.inputTokens),
          cacheRead: FieldValue.increment(usage.cacheReadTokens),
          cacheWrite: FieldValue.increment(usage.cacheWriteTokens),
          output: FieldValue.increment(usage.outputTokens)
        }
      } : {})
    }, { merge: true });
    const delta = settlementDelta(this.costs, settlement);
    if (delta) {
      batch.set(this.db.doc(`${FirestorePath.Usage}/${monthKey(now)}`), { [FirestoreField.CostMicros]: FieldValue.increment(delta) }, { merge: true });
    }
    await batch.commit();
  }
}
