import { describe, expect, it } from "vitest";
import { ask, AskDeps, InvalidRequestError } from "../src/core/ask";
import { LimitStore } from "../src/core/limits";
import { ModelError } from "../src/core/model";
import { answered, knowledge, StubModel, store, USAGE } from "./helpers";

const K = knowledge();
const NOW = new Date("2026-10-28T10:00:00Z");

function deps(overrides: Partial<AskDeps> = {}): AskDeps & { events: Record<string, unknown>[] } {
  const events: Record<string, unknown>[] = [];
  return {
    knowledge: K,
    store: store(),
    model: new StubModel(() => answered([{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }])),
    clientKey: "client",
    now: () => NOW,
    log: event => events.push(event),
    events,
    ...overrides
  };
}

const body = (extra: Record<string, unknown> = {}) =>
  ({ question: "How many years of Java experience do you have?", locale: "en", knowledgeVersion: K.version, ...extra });

describe("ask", () => {
  it("answers, with the cited note's citation data, and counts the call", async () => {
    const d = deps();
    const result = await ask(body(), d);
    expect(result).toEqual({
      kind: "generated",
      knowledgeVersion: K.version,
      paragraphs: [{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }],
      partial: false,
      notes: [{ id: "java-experience", title: "Java experience", updated: "2026-10", related: [3, 4, 5, 6] }]
    });
    const memory = d.store as ReturnType<typeof store>;
    expect(memory.days.get("2026-10-28")).toEqual({ calls: 1, outcomes: { answered: 1 } });
    expect(memory.months.get("2026-10")!.costMicros).toBeGreaterThan(0);
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
    expect(await ask(body(), deps({ model, store: store(false) }))).toEqual({ kind: "unavailable", reason: "disabled", retryable: false });
    expect(await ask(body({ knowledgeVersion: "v1-00000000-1" }), deps({ model }))).toEqual({ kind: "version-mismatch" });
    const full = store();
    for (let i = 0; i < 5; i++) {
      await full.reserve(`other-${i}`, NOW);
    }
    expect(await ask(body(), deps({ model, store: full }))).toEqual({ kind: "unavailable", reason: "limited", retryable: false });
    expect(model.requests.length).toBe(0);
  });

  it("fails closed when the limit store is down", async () => {
    const broken: LimitStore = { enabled: async () => true, reserve: async () => { throw new Error("down"); }, record: async () => undefined };
    const model = new StubModel(() => { throw new Error("must not be called"); });
    expect(await ask(body(), deps({ store: broken, model }))).toEqual({ kind: "unavailable", reason: "error", retryable: true });
  });

  it("rejects malformed requests before anything else", async () => {
    await expect(ask({ question: "", locale: "en", knowledgeVersion: K.version }, deps())).rejects.toBeInstanceOf(InvalidRequestError);
    await expect(ask(body({ extra: 1 }), deps())).rejects.toThrow(/unexpected field/);
    await expect(ask(body({ context: { experienceId: 99 } }), deps())).rejects.toThrow(/existing experience/);
    await expect(ask(body({ history: Array(3).fill({ question: "q", answer: "a" }) }), deps())).rejects.toThrow(/at most 2/);
  });

  it("maps model outcomes", async () => {
    const run = (reply: ConstructorParameters<typeof StubModel>[0]) => ask(body(), deps({ model: new StubModel(reply) }));
    expect(await run(() => ({ kind: "ok", usage: USAGE, json: { status: "unsupported", partial: false, subjectExperienceId: null, paragraphs: [] } })))
      .toEqual({ kind: "fallback" });
    expect(await run(() => ({ kind: "no-answer", reason: "refusal", usage: USAGE }))).toEqual({ kind: "fallback" });
    expect(await run(() => ({ kind: "no-answer", reason: "max_tokens", usage: USAGE }))).toEqual({ kind: "unavailable", reason: "invalid", retryable: false });
    expect(await run(() => answered([{ text: "I have 12 years of Java experience.", evidence: ["ctx.java-experience"] }])))
      .toEqual({ kind: "unavailable", reason: "invalid", retryable: false });
    expect(await run(() => { throw new ModelError("timed out", true); })).toEqual({ kind: "unavailable", reason: "error", retryable: true });
  });

  it("keeps the question and the answer out of the logs", async () => {
    const d = deps();
    await ask(body({ question: "SECRET-QUESTION-TEXT about Java" }), d);
    const logged = JSON.stringify(d.events);
    expect(logged).not.toContain("SECRET-QUESTION-TEXT");
    expect(logged).not.toContain("since 2014");
    expect(d.events[0]).toEqual(expect.objectContaining({ event: "ask", result: "generated", outcome: "answered" }));
  });
});
