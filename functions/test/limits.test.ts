import { describe, expect, it } from "vitest";
import { clientKey, costMicros, reserve } from "../src/core/limits";
import { CONFIG, store } from "./helpers";

const NOW = new Date("2026-10-28T10:00:30Z");

describe("reserve", () => {
  it("counts a first call", () => {
    expect(reserve(CONFIG, NOW, undefined, undefined, undefined)).toEqual({
      allowed: true,
      day: { calls: 1 },
      client: { minuteWindow: Date.parse("2026-10-28T10:00:00Z"), minuteCount: 1, day: "2026-10-28", dayCount: 1 }
    });
  });

  it("refuses at each limit", () => {
    const client = { minuteWindow: Date.parse("2026-10-28T10:00:00Z"), minuteCount: 0, day: "2026-10-28", dayCount: 0 };
    expect(reserve(CONFIG, NOW, { calls: 5 }, undefined, undefined).limit).toBe("daily");
    expect(reserve(CONFIG, NOW, undefined, { costMicros: 1_000_000 }, undefined).limit).toBe("monthly");
    expect(reserve(CONFIG, NOW, undefined, undefined, { ...client, minuteCount: 3 }).limit).toBe("client-minute");
    expect(reserve(CONFIG, NOW, undefined, undefined, { ...client, dayCount: 4 }).limit).toBe("client-day");
  });

  it("starts a new minute and a new day for the same visitor", () => {
    const old = { minuteWindow: Date.parse("2026-10-27T10:00:00Z"), minuteCount: 3, day: "2026-10-27", dayCount: 4 };
    expect(reserve(CONFIG, NOW, undefined, undefined, old).client).toEqual(expect.objectContaining({ minuteCount: 1, dayCount: 1 }));
  });

  it("never lets concurrent callers past the daily limit", async () => {
    const memory = store();
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => memory.reserve(`client-${i}`, NOW)));
    expect(results.filter(r => r.allowed).length).toBe(CONFIG.dailyCalls);
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

describe("costMicros", () => {
  it("prices a cache miss at the eu rates", () => {
    expect(costMicros({ inputTokens: 400, cacheWriteTokens: 6000, cacheReadTokens: 0, outputTokens: 350 })).toBe(1062);
  });
});
