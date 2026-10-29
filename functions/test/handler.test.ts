import { describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { HostedResultKind, UnavailableReason } from "../../src/app/assistant/models/hosted-answer.models";
import { AskCall, AskServices, createAskHandler } from "../src/core/handler";
import { LimitStore } from "../src/core/limits";
import { answered, COSTS, knowledge, StubModel, store } from "./helpers";

const K = knowledge();
const NOW = new Date("2026-10-28T10:00:00Z");
const FRONT_END = "169.254.1.1";

function services(overrides: Partial<AskServices> = {}): AskServices {
  return {
    knowledge: K,
    store: store(),
    model: new StubModel(() => answered([{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }])),
    costs: COSTS,
    salt: "salt",
    trustedProxyHops: 1,
    now: () => NOW,
    log: () => undefined,
    ...overrides
  };
}

const call = (forwardedFor: string | undefined, extra: Partial<AskCall> = {}): AskCall => ({
  data: { question: "How many years of Java experience do you have?", locale: "en", knowledgeVersion: K.version },
  rawRequest: { headers: forwardedFor === undefined ? {} : { "x-forwarded-for": forwardedFor }, socket: { remoteAddress: FRONT_END } },
  ...extra
});

/** A store that fails the test if it is touched at all. */
const untouchable = (): LimitStore => ({
  enabled: vi.fn(async () => { throw new Error("store must not be called"); }),
  reserve: vi.fn(async () => { throw new Error("store must not be called"); }),
  saveQuestion: vi.fn(async () => { throw new Error("store must not be called"); }),
  record: vi.fn(async () => { throw new Error("store must not be called"); })
});

describe("askAssistant handler", () => {
  it("rejects a replayed App Check token before building services, the store or the model", async () => {
    const factory = vi.fn(() => services({ store: untouchable() }));
    const handler = createAskHandler(factory);
    await expect(handler(call("203.0.113.7", { app: { alreadyConsumed: true } })))
      .rejects.toSatisfy((e: unknown) => e instanceof HttpsError && e.code === "unauthenticated");
    expect(factory).not.toHaveBeenCalled();
  });

  it("refuses a request whose visitor address can't be resolved, without touching the store or the model", async () => {
    const model = new StubModel(() => { throw new Error("model must not be called"); });
    const handler = createAskHandler(() => services({ store: untouchable(), model }));
    await expect(handler(call(undefined, { rawRequest: { headers: {} } })))
      .rejects.toSatisfy((e: unknown) => e instanceof HttpsError && e.code === "failed-precondition");
    expect(model.requests.length).toBe(0);
  });

  it("answers a valid call", async () => {
    const result = await createAskHandler(() => services())(call("203.0.113.7"));
    expect(result.kind).toBe(HostedResultKind.Generated);
  });

  it("keeps one visitor on one rate-limit key whatever they forge in X-Forwarded-For", async () => {
    const memory = store(true, { dailyCalls: 100, perClientPerMinute: 2, perClientPerDay: 100, monthlyBudgetMicros: 10_000_000 });
    const handler = createAskHandler(() => services({ store: memory }));
    const results = [];
    for (const forged of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
      results.push(await handler(call(`${forged}, 203.0.113.7`)));
    }
    expect(results.map(r => r.kind)).toEqual([HostedResultKind.Generated, HostedResultKind.Generated, HostedResultKind.Unavailable]);
    expect(results[2]).toEqual({ kind: HostedResultKind.Unavailable, reason: UnavailableReason.Limited, retryable: false });
    expect(memory.clients.size).toBe(1);
  });

  it("maps a malformed request to invalid-argument", async () => {
    await expect(createAskHandler(() => services())(call("203.0.113.7", { data: { question: "" } })))
      .rejects.toSatisfy((e: unknown) => e instanceof HttpsError && e.code === "invalid-argument");
  });
});
