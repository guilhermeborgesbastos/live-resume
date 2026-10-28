import { AnswerResult, HostedAnswerKind, PairAnswer } from "../models/assistant.models";
import { HostedResultKind, MAX_HISTORY_ANSWER_LENGTH, UnavailableReason } from "../models/hosted-answer.models";
import { snapshotOf } from "../testing/assistant-fixtures";
import { historyFor, isHostedEligible, toPairAnswer } from "./hosted-answer";

describe("hosted answers (pure helpers)", () => {
  const snapshot = snapshotOf();

  it("sends only fallbacks a model could answer", () => {
    const fallback = (reason: any): AnswerResult => ({ kind: "fallback", reason });
    expect(isHostedEligible(fallback("unrecognized"))).toBeTrue();
    expect(isHostedEligible(fallback("unknown-entity"))).toBeTrue();
    expect(isHostedEligible(fallback("no-results"))).toBeTrue();
    expect(isHostedEligible(fallback("missing-fact"))).toBeFalse();
    expect(isHostedEligible(fallback("ambiguous"))).toBeFalse();
    expect(isHostedEligible({ kind: "clarify", reason: "typo", options: [] })).toBeFalse();
  });

  it("keeps the two latest answered exchanges, as trimmed plain text", () => {
    const generated = (text: string): PairAnswer => ({ kind: HostedAnswerKind.Generated, paragraphs: [text], sources: [], partial: false, usesNotes: false });
    const history = historyFor([
      { question: "one", answer: generated("first") },
      { question: "skip", answer: { kind: "fallback", reason: "unrecognized" } },
      { question: "two", answer: generated("second") },
      { question: "three", answer: generated("x".repeat(700)) },
      { question: "waiting", answer: { kind: HostedAnswerKind.Pending } }
    ]);
    expect(history.map(h => h.question)).toEqual(["two", "three"]);
    expect([...history[1].answer].length).toBe(MAX_HISTORY_ANSWER_LENGTH);
  });

  it("builds citations from this page's data, notes first-class with their related roles", () => {
    const answer = toPairAnswer({
      kind: HostedResultKind.Generated,
      knowledgeVersion: "v1-00000000-1",
      paragraphs: [{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience", "exp.6.tech"] }],
      partial: true,
      subject: { experienceId: 6 },
      notes: [{ id: "java-experience", title: "Java experience", updated: "2026-10", related: [4] }]
    }, snapshot, "en");
    expect(answer.kind).toBe(HostedAnswerKind.Generated);
    if (answer.kind !== HostedAnswerKind.Generated) {
      return;
    }
    expect(answer.paragraphs).toEqual(["I have worked with Java since 2014."]);
    expect(answer.partial).toBeTrue();
    expect(answer.usesNotes).toBeTrue();
    expect(answer.subject).toEqual({ experienceId: 6 });
    expect(answer.sources.map(s => [s.recordKey, s.label])).toEqual([
      ["java-experience", "My notes · Java experience (Oct 2026)"],
      ["6", "Experience · Swisscom AG"],
      ["4", "Experience · SkyDreamer"]
    ]);
  });

  it("drops a subject this page doesn't know", () => {
    const answer = toPairAnswer({
      kind: HostedResultKind.Generated, knowledgeVersion: "v1-00000000-1", partial: false, notes: [],
      paragraphs: [{ text: "Text.", evidence: ["about.description"] }], subject: { experienceId: 99 }
    }, snapshot, "pt");
    expect(answer.kind === HostedAnswerKind.Generated && answer.subject).toBeFalsy();
  });

  it("maps the other replies to fixed states", () => {
    expect(toPairAnswer({ kind: HostedResultKind.Fallback }, snapshot, "en")).toEqual({ kind: "fallback", reason: "unrecognized" });
    expect(toPairAnswer({ kind: HostedResultKind.Unavailable, reason: UnavailableReason.Limited, retryable: false }, snapshot, "en")).toEqual({ kind: HostedAnswerKind.Unavailable });
    expect(toPairAnswer({ kind: HostedResultKind.VersionMismatch }, snapshot, "en")).toEqual({ kind: HostedAnswerKind.VersionMismatch });
  });
});
