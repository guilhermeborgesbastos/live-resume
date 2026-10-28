import { describe, expect, it } from "vitest";
import { HostedResultKind, UnavailableReason } from "../../src/app/assistant/models/hosted-answer.models";
import { ask, AskDeps, InvalidRequestError } from "../src/core/ask";
import { LogEvent, ModelAnswerStatus, ModelReplyKind, NoAnswerReason, Outcome } from "../src/core/constants";
import { LimitStore, MemoryLimitStore } from "../src/core/limits";
import { MAX_OUTPUT_TOKENS, ModelError } from "../src/core/model";
import { answered, CONFIG, COSTS, knowledge, StubModel, store, USAGE } from "./helpers";

const K = knowledge();
const NOW = new Date("2026-10-28T10:00:00Z");
const RESERVED = COSTS.ceiling(K.locales.en.maxInputTokens, MAX_OUTPUT_TOKENS);

function deps(overrides: Partial<AskDeps> = {}): AskDeps & { events: Record<string, unknown>[] } {
  const events: Record<string, unknown>[] = [];
  return {
    knowledge: K,
    store: store(),
    model: new StubModel(() => answered([{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }])),
    costs: COSTS,
    clientKey: "client",
    now: () => NOW,
    log: event => events.push(event),
    events,
    ...overrides
  };
}

const body = (extra: Record<string, unknown> = {}) =>
  ({ question: "How many years of Java experience do you have?", locale: "en", knowledgeVersion: K.version, ...extra });

const unavailable = (reason: UnavailableReason, retryable = false) => ({ kind: HostedResultKind.Unavailable, reason, retryable });

describe("ask", () => {
  it("answers, with the cited note's citation data, and settles the call at its actual cost", async () => {
    const d = deps();
    const result = await ask(body(), d);
    expect(result).toEqual({
      kind: HostedResultKind.Generated,
      knowledgeVersion: K.version,
      paragraphs: [{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }],
      partial: false,
      notes: [{ id: "java-experience", title: "Java experience", updated: "2026-10", related: [3, 4, 5, 6] }]
    });
    const memory = d.store as MemoryLimitStore;
    expect(memory.days.get("2026-10-28")).toEqual({ calls: 1, outcomes: { [Outcome.Answered]: 1 } });
    expect(memory.months.get("2026-10")).toEqual({ costMicros: COSTS.cost(USAGE) });
  });

  it("sends the cached prefix and only the request's own text to the model", async () => {
    const model = new StubModel(() => answered([{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }]));
    await ask(body({ context: { experienceId: 6 }, history: [{ question: "Where do you work?", answer: "At Swisscom AG." }] }), deps({ model }));
    const request = model.requests[0];
    expect(request.system).toEqual(K.locales.en.system);
    expect(request.user).toBe("<previous_turns>\nVisitor: Where do you work?\nAssistant: At Swisscom AG.\n</previous_turns>\n\n"
      + "<current_role>exp.6</current_role>\n\n<question>\nHow many years of Java experience do you have?\n</question>");
  });

  it("makes no model call when the switch is off, the version differs or a limit is reached", async () => {
    const model = new StubModel(() => { throw new Error("must not be called"); });
    expect(await ask(body(), deps({ model, store: store(false) }))).toEqual(unavailable(UnavailableReason.Disabled));
    expect(await ask(body({ knowledgeVersion: "v1-00000000-1" }), deps({ model }))).toEqual({ kind: HostedResultKind.VersionMismatch });
    const full = store();
    for (let i = 0; i < CONFIG.dailyCalls; i++) {
      await full.reserve(`other-${i}`, NOW, 0);
    }
    expect(await ask(body(), deps({ model, store: full }))).toEqual(unavailable(UnavailableReason.Limited));
    const broke = store(true, { ...CONFIG, monthlyBudgetMicros: RESERVED - 1 });
    expect(await ask(body(), deps({ model, store: broke }))).toEqual(unavailable(UnavailableReason.Limited));
    expect(model.requests.length).toBe(0);
  });

  it("fails closed when the limit store is down", async () => {
    const broken: LimitStore = { enabled: async () => true, reserve: async () => { throw new Error("down"); }, record: async () => undefined };
    const model = new StubModel(() => { throw new Error("must not be called"); });
    expect(await ask(body(), deps({ store: broken, model }))).toEqual(unavailable(UnavailableReason.Error, true));
  });

  it("keeps every paid call reserved on the month when settling fails", async () => {
    const memory = store();
    memory.record = async () => { throw new Error("ledger write failed"); };
    const d = deps({ store: memory });
    await ask(body(), d);
    await ask(body(), d);
    expect(memory.months.get("2026-10")).toEqual({ costMicros: 2 * RESERVED });
    expect(d.events.filter(e => e["event"] === LogEvent.RecordFailed).length).toBe(2);
  });

  it("keeps the reservation when the model call fails", async () => {
    const memory = store();
    await ask(body(), deps({ store: memory, model: new StubModel(() => { throw new ModelError("timed out", true); }) }));
    expect(memory.months.get("2026-10")).toEqual({ costMicros: RESERVED });
  });

  it("rejects malformed requests before anything else", async () => {
    await expect(ask({ question: "", locale: "en", knowledgeVersion: K.version }, deps())).rejects.toBeInstanceOf(InvalidRequestError);
    await expect(ask(body({ extra: 1 }), deps())).rejects.toThrow(/unexpected field/);
    await expect(ask(body({ locale: "fr" }), deps())).rejects.toThrow(/locale must be one of en, pt/);
    await expect(ask(body({ context: { experienceId: 99 } }), deps())).rejects.toThrow(/existing experience/);
    await expect(ask(body({ history: Array(3).fill({ question: "q", answer: "a" }) }), deps())).rejects.toThrow(/at most 2/);
  });

  it("maps model outcomes", async () => {
    const run = (reply: ConstructorParameters<typeof StubModel>[0]) => ask(body(), deps({ model: new StubModel(reply) }));
    expect(await run(() => ({
      kind: ModelReplyKind.Ok,
      usage: USAGE,
      json: { status: ModelAnswerStatus.Unsupported, partial: false, subjectExperienceId: null, paragraphs: [] }
    }))).toEqual({ kind: HostedResultKind.Fallback });
    expect(await run(() => ({ kind: ModelReplyKind.NoAnswer, reason: NoAnswerReason.Refusal, usage: USAGE }))).toEqual({ kind: HostedResultKind.Fallback });
    expect(await run(() => ({ kind: ModelReplyKind.NoAnswer, reason: NoAnswerReason.MaxTokens, usage: USAGE }))).toEqual(unavailable(UnavailableReason.Invalid));
    expect(await run(() => answered([{ text: "I have 12 years of Java experience.", evidence: ["ctx.java-experience"] }])))
      .toEqual(unavailable(UnavailableReason.Invalid));
    expect(await run(() => { throw new ModelError("timed out", true); })).toEqual(unavailable(UnavailableReason.Error, true));
  });

  it("keeps the question and the answer out of the logs", async () => {
    const d = deps();
    await ask(body({ question: "SECRET-QUESTION-TEXT about Java" }), d);
    const logged = JSON.stringify(d.events);
    expect(logged).not.toContain("SECRET-QUESTION-TEXT");
    expect(logged).not.toContain("since 2014");
    expect(d.events[0]).toEqual(expect.objectContaining({ event: LogEvent.Ask, result: HostedResultKind.Generated, outcome: Outcome.Answered }));
  });
});
