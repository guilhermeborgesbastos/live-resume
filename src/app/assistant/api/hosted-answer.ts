/*
 * Pure helpers around hosted AI answers: which local results go to the function, what earlier
 * conversation goes with them, and how the function's reply becomes something the
 * conversation can show (with citations built from this page's own CV data).
 */
import { answerPlainText } from "../engine/assistant-engine";
import { ContextNote } from "../knowledge/assistant-context";
import { buildEvidenceMap, sourcesFor } from "../knowledge/evidence-map";
import { AnswerResult, FallbackReason, KnowledgeSnapshot, Locale, PairAnswer } from "../models/assistant.models";
import { AskAssistantResult, HistoryPair, MAX_HISTORY_ANSWER_LENGTH, MAX_HISTORY_PAIRS } from "../models/hosted-answer.models";

/**
 * Local fallbacks the model may be able to answer. "missing-fact" (the CV doesn't hold the fact)
 * and "ambiguous" stay local: a model could only guess there.
 */
export const HOSTED_FALLBACK_REASONS: readonly FallbackReason[] = ["unrecognized", "unknown-entity", "no-results"];

export function isHostedEligible(answer: AnswerResult): boolean {
  return answer.kind === "fallback" && HOSTED_FALLBACK_REASONS.includes(answer.reason);
}

/** The text of a finished answer, for history and the live region; empty for anything else. */
export function answerText(answer: PairAnswer): string {
  switch (answer.kind) {
    case "answered": return answerPlainText(answer.blocks);
    case "generated": return answer.paragraphs.join("\n");
    default: return "";
  }
}

/** The latest answered exchanges (at most MAX_HISTORY_PAIRS), oldest first, trimmed to the request limits. */
export function historyFor(pairs: readonly { readonly question: string; readonly answer: PairAnswer }[]): HistoryPair[] {
  return pairs
    .filter(pair => pair.answer.kind === "answered" || pair.answer.kind === "generated")
    .slice(-MAX_HISTORY_PAIRS)
    .map(pair => ({ question: pair.question, answer: truncate(answerText(pair.answer), MAX_HISTORY_ANSWER_LENGTH) }));
}

function truncate(text: string, max: number): string {
  const characters = [...text];
  return characters.length <= max ? text : characters.slice(0, max - 1).join("") + "…";
}

/**
 * Turns the function's reply into a conversation answer. Citations are rebuilt from this page's
 * snapshot (the reply only carries evidence IDs); cited notes come with the reply, because the
 * page doesn't load assistant-context.txt.
 */
export function toPairAnswer(result: AskAssistantResult, snapshot: KnowledgeSnapshot, locale: Locale): PairAnswer {
  switch (result.kind) {
    case "fallback":
      return { kind: "fallback", reason: "unrecognized" };
    case "unavailable":
      return { kind: "ai-unavailable" };
    case "version-mismatch":
      return { kind: "version-mismatch" };
    case "generated": {
      const notes: ContextNote[] = result.notes.map(note => ({
        id: note.id,
        updated: note.updated,
        related: note.related,
        line: 0,
        locales: { en: { title: note.title, text: "" }, pt: { title: note.title, text: "" } }
      }));
      const map = buildEvidenceMap(snapshot, notes, locale);
      const ids = result.paragraphs.flatMap(p => p.evidence);
      const subject = result.subject && snapshot.experiences.some(e => e.id === result.subject!.experienceId) ? result.subject : undefined;
      return {
        kind: "generated",
        paragraphs: result.paragraphs.map(p => p.text),
        sources: sourcesFor(map, ids),
        partial: result.partial,
        usesNotes: ids.some(id => id.startsWith("ctx.")),
        ...(subject ? { subject: { experienceId: subject.experienceId } } : {})
      };
    }
  }
}
