import { describe, expect, it } from "vitest";
import { LimitName, Outcome } from "../src/core/constants";
import { clientKey, reserve } from "../src/core/limits";
import { CONFIG, COSTS, store, USAGE } from "./helpers";

const NOW = new Date("2026-10-28T10:00:30Z");
const RESERVE = 2_000;

describe("reserve", () => {
  it("counts a first call and reserves its cost ceiling", () => {
    expect(reserve(CONFIG, NOW, RESERVE, undefined, undefined, undefined)).toEqual({
      allowed: true,
      day: { calls: 1 },
      month: { costMicros: RESERVE },
      client: { minuteWindow: Date.parse("2026-10-28T10:00:00Z"), minuteCount: 1, day: "2026-10-28", dayCount: 1 },
      reservedMicros: RESERVE
    });
  });

  it("refuses at each limit", () => {
    const client = { minuteWindow: Date.parse("2026-10-28T10:00:00Z"), minuteCount: 0, day: "2026-10-28", dayCount: 0 };
    expect(reserve(CONFIG, NOW, RESERVE, { calls: 5 }, undefined, undefined).limit).toBe(LimitName.Daily);
    expect(reserve(CONFIG, NOW, RESERVE, undefined, { costMicros: CONFIG.monthlyBudgetMicros - RESERVE + 1 }, undefined).limit).toBe(LimitName.Monthly);
    expect(reserve(CONFIG, NOW, RESERVE, undefined, undefined, { ...client, minuteCount: 3 }).limit).toBe(LimitName.ClientMinute);
    expect(reserve(CONFIG, NOW, RESERVE, undefined, undefined, { ...client, dayCount: 4 }).limit).toBe(LimitName.ClientDay);
  });

  it("starts a new minute and a new day for the same visitor", () => {
    const old = { minuteWindow: Date.parse("2026-10-27T10:00:00Z"), minuteCount: 3, day: "2026-10-27", dayCount: 4 };
    expect(reserve(CONFIG, NOW, RESERVE, undefined, undefined, old).client).toEqual(expect.objectContaining({ minuteCount: 1, dayCount: 1 }));
  });

  it("never lets concurrent callers past the daily limit", async () => {
    const memory = store();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => memory.reserve(`client-${i}`, NOW, RESERVE)));
    expect(results.filter(r => r.allowed).length).toBe(CONFIG.dailyCalls);
  });

  it("never lets concurrent callers spend the same remaining budget", async () => {
    const memory = store(true, { ...CONFIG, dailyCalls: 100, monthlyBudgetMicros: RESERVE + 1 });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => memory.reserve(`client-${i}`, NOW, RESERVE)));
    expect(results.filter(r => r.allowed).length).toBe(1);
    expect(results.filter(r => !r.allowed).every(r => r.limit === LimitName.Monthly)).toBe(true);
  });
});

describe("settlement", () => {
  it("replaces the reservation with the actual cost", async () => {
    const memory = store();
    await memory.reserve("client", NOW, RESERVE);
    await memory.record(NOW, Outcome.Answered, { reservedMicros: RESERVE, usage: USAGE });
    expect(memory.months.get("2026-10")).toEqual({ costMicros: COSTS.cost(USAGE) });
  });

  it("keeps the reservation when the actual cost is unknown", async () => {
    const memory = store();
    await memory.reserve("client", NOW, RESERVE);
    await memory.record(NOW, Outcome.Error, { reservedMicros: RESERVE });
    expect(memory.months.get("2026-10")).toEqual({ costMicros: RESERVE });
  });
});

describe("clientKey", () => {
  it("is stable within a day, changes daily and doesn't contain the IP", () => {
    const key = clientKey("salt", "203.0.113.7", NOW);
    expect(key).toBe(clientKey("salt", "203.0.113.7", new Date("2026-10-28T23:59:00Z")));
    expect(key).not.toBe(clientKey("salt", "203.0.113.7", new Date("2026-10-29T00:00:00Z")));
    expect(key).not.toBe(clientKey("other", "203.0.113.7", NOW));
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });
});
