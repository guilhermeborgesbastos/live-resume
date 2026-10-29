import { describe, expect, it } from "vitest";
import { Outcome } from "../src/core/constants";
import { costPolicy, Tariff, tariffFor, TARIFFS, UnknownTariffError } from "../src/core/pricing";
import { CONFIG, store, USAGE } from "./helpers";

const NOW = new Date("2026-10-28T10:00:00Z");

describe("tariffFor", () => {
  it("prices Claude Haiku 5.5 at the Claude API list price", () => {
    expect(tariffFor("claude-haiku-5-5")).toEqual({ model: "claude-haiku-5-5", input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 });
  });

  it("refuses a model without a price", () => {
    expect(() => tariffFor("claude-sonnet-5-5")).toThrow(UnknownTariffError);
    expect(() => tariffFor("claude-haiku-4-5")).toThrow(/No price is configured/);
  });

  it("has one price per model", () => {
    const models = TARIFFS.map(t => t.model);
    expect(new Set(models).size).toBe(models.length);
  });
});

describe("cost policy", () => {
  it("prices a cache miss", () => {
    const haiku = costPolicy(tariffFor("claude-haiku-5-5"));
    expect(haiku.cost({ inputTokens: 400, cacheWriteTokens: 6000, cacheReadTokens: 0, outputTokens: 350 })).toBe(965);
  });

  it("bounds every call it could make", () => {
    const haiku = costPolicy(tariffFor("claude-haiku-5-5"));
    expect(haiku.ceiling(7000, 1024)).toBeGreaterThanOrEqual(haiku.cost({ inputTokens: 1000, cacheWriteTokens: 6000, cacheReadTokens: 0, outputTokens: 1024 }));
  });

  it("changes what the limiter charges without changing the limiter", async () => {
    const pricier: Tariff = { model: "other", input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };
    const cheap = store(true, CONFIG, costPolicy(tariffFor("claude-haiku-5-5")));
    const expensive = store(true, CONFIG, costPolicy(pricier));
    for (const memory of [cheap, expensive]) {
      await memory.reserve("client", NOW, 0);
      await memory.record(NOW, Outcome.Answered, { reservedMicros: 0, usage: USAGE });
    }
    expect(expensive.months.get("2026-10")!.costMicros).toBe(costPolicy(pricier).cost(USAGE));
    expect(expensive.months.get("2026-10")!.costMicros).toBeGreaterThan(cheap.months.get("2026-10")!.costMicros);
  });
});
