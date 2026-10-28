import { describe, expect, it } from "vitest";
import { Outcome } from "../src/core/constants";
import { costPolicy, Tariff, tariffFor, TARIFFS, UnknownTariffError } from "../src/core/pricing";
import { CONFIG, store, USAGE } from "./helpers";

const NOW = new Date("2026-10-28T10:00:00Z");

describe("tariffFor", () => {
  it("prices the eu multi-region 10% above global", () => {
    const global = tariffFor("claude-haiku-5-5", "global");
    const eu = tariffFor("claude-haiku-5-5", "eu");
    expect(eu.input).toBeCloseTo(global.input * 1.1);
    expect(eu.output).toBeCloseTo(global.output * 1.1);
  });

  it("refuses a model or region without a price", () => {
    expect(() => tariffFor("claude-sonnet-5-5", "eu")).toThrow(UnknownTariffError);
    expect(() => tariffFor("claude-haiku-5-5", "asia")).toThrow(/No price is configured/);
  });

  it("knows every region the function can be configured with", () => {
    expect(TARIFFS.map(t => t.region).sort()).toEqual(["eu", "global", "us"]);
  });
});

describe("cost policy", () => {
  it("prices a cache miss at the eu rates", () => {
    const eu = costPolicy(tariffFor("claude-haiku-5-5", "eu"));
    expect(eu.cost({ inputTokens: 400, cacheWriteTokens: 6000, cacheReadTokens: 0, outputTokens: 350 })).toBe(1062);
  });

  it("bounds every call it could make", () => {
    const eu = costPolicy(tariffFor("claude-haiku-5-5", "eu"));
    expect(eu.ceiling(7000, 1024)).toBeGreaterThanOrEqual(eu.cost({ inputTokens: 1000, cacheWriteTokens: 6000, cacheReadTokens: 0, outputTokens: 1024 }));
  });

  it("changes what the limiter charges without changing the limiter", async () => {
    const pricier: Tariff = { model: "other", region: "eu", input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };
    const cheap = store(true, CONFIG, costPolicy(tariffFor("claude-haiku-5-5", "global")));
    const expensive = store(true, CONFIG, costPolicy(pricier));
    for (const memory of [cheap, expensive]) {
      await memory.reserve("client", NOW, 0);
      await memory.record(NOW, Outcome.Answered, { reservedMicros: 0, usage: USAGE });
    }
    expect(expensive.months.get("2026-10")!.costMicros).toBe(costPolicy(pricier).cost(USAGE));
    expect(expensive.months.get("2026-10")!.costMicros).toBeGreaterThan(cheap.months.get("2026-10")!.costMicros);
  });
});
