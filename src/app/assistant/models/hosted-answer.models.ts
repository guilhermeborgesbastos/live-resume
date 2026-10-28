/*
 * The contract between the browser and the askAssistant Cloud Function (hosted AI answers for
 * questions the local engine can't answer). Shared by both sides, so it stays free of Angular.
 */
import { ASSISTANT_LOCALES, Locale } from "./assistant.models";

export const HOSTED_FUNCTION_NAME = "askAssistant";
export const MAX_HOSTED_QUESTION_LENGTH = 500;
export const MAX_HISTORY_PAIRS = 2;
export const MAX_HISTORY_ANSWER_LENGTH = 600;
export const MAX_PARAGRAPHS = 3;
export const MAX_PARAGRAPH_LENGTH = 600;
export const MAX_ANSWER_LENGTH = 900;
export const MAX_EVIDENCE_PER_PARAGRAPH = 8;

/** One earlier exchange in the visible conversation, as plain text. Never used as evidence. */
export interface HistoryPair {
  readonly question: string;
  readonly answer: string;
}

export interface AskAssistantRequest {
  readonly question: string;
  readonly locale: Locale;
  /** knowledgeVersion() of the JSON the page loaded. */
  readonly knowledgeVersion: string;
  /** The experience the latest answer was about, for follow-ups ("and before that?"). */
  readonly context?: { readonly experienceId: number };
  /** Up to MAX_HISTORY_PAIRS latest pairs, oldest first. */
  readonly history?: readonly HistoryPair[];
}

export interface GeneratedParagraph {
  readonly text: string;
  /** Evidence IDs from evidence-map.ts that support this paragraph. */
  readonly evidence: readonly string[];
}

/** A cited note from assistant-context.txt; the browser doesn't load that file, so the function sends what the citation needs. */
export interface HostedNote {
  readonly id: string;
  /** Title in the request's locale. */
  readonly title: string;
  /** "YYYY-MM". */
  readonly updated: string;
  readonly related: readonly number[];
}

export enum UnavailableReason {
  /** The kill switch is off. */
  Disabled = "disabled",
  /** A daily, monthly or per-visitor limit was reached. */
  Limited = "limited",
  /** The model or a dependency failed or timed out. */
  Error = "error",
  /** The model's output failed validation; nothing of it is shown. */
  Invalid = "invalid"
}

export enum HostedResultKind {
  Generated = "generated",
  Fallback = "fallback",
  Unavailable = "unavailable",
  VersionMismatch = "version-mismatch"
}

export type AskAssistantResult =
  | {
      readonly kind: HostedResultKind.Generated;
      readonly knowledgeVersion: string;
      readonly paragraphs: readonly GeneratedParagraph[];
      /** Part of the question isn't covered by the CV; the browser adds the fixed "not covered" line. */
      readonly partial: boolean;
      readonly subject?: { readonly experienceId: number };
      readonly notes: readonly HostedNote[];
    }
  /** The model found nothing in the CV to answer with; the browser shows the fixed fallback. */
  | { readonly kind: HostedResultKind.Fallback }
  | { readonly kind: HostedResultKind.Unavailable; readonly reason: UnavailableReason; readonly retryable: boolean }
  | { readonly kind: HostedResultKind.VersionMismatch };

/** Every field a request may carry; anything else is rejected. */
const REQUEST_FIELDS: readonly (keyof AskAssistantRequest)[] = ["question", "locale", "knowledgeVersion", "context", "history"];

/** Code points, like validateQuestion: a surrogate pair counts once. */
const length = (text: string): number => [...text].length;

/**
 * Checks an untrusted request body (the function never trusts the browser). Returns the
 * request with trimmed strings, or the reason it was rejected.
 */
export function parseAskRequest(body: unknown, experienceIds: readonly number[]): AskAssistantRequest | { readonly error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "body must be an object" };
  }
  const input = body as Partial<Record<keyof AskAssistantRequest, unknown>>;
  const extra = Object.keys(input).filter(key => !(REQUEST_FIELDS as readonly string[]).includes(key));
  if (extra.length) {
    return { error: `unexpected field(s): ${extra.join(", ")}` };
  }
  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (!question || length(question) > MAX_HOSTED_QUESTION_LENGTH) {
    return { error: `question must be 1-${MAX_HOSTED_QUESTION_LENGTH} characters` };
  }
  const locale = ASSISTANT_LOCALES.find(l => l === input.locale);
  if (!locale) {
    return { error: `locale must be one of ${ASSISTANT_LOCALES.join(", ")}` };
  }
  const knowledgeVersion = input.knowledgeVersion;
  if (typeof knowledgeVersion !== "string" || !/^v\d+-[0-9a-f]{8}-[0-9a-f]+$/.test(knowledgeVersion)) {
    return { error: "knowledgeVersion is malformed" };
  }

  let context: AskAssistantRequest["context"];
  if (input.context !== undefined) {
    const raw = input.context as Partial<Record<keyof NonNullable<AskAssistantRequest["context"]>, unknown>> | null;
    const id = raw && typeof raw === "object" ? raw.experienceId : undefined;
    if (!raw || Object.keys(raw).length !== 1 || typeof id !== "number" || !experienceIds.includes(id)) {
      return { error: "context must be { experienceId } of an existing experience" };
    }
    context = { experienceId: id };
  }

  let history: HistoryPair[] | undefined;
  if (input.history !== undefined) {
    const raw = input.history;
    if (!Array.isArray(raw) || raw.length > MAX_HISTORY_PAIRS) {
      return { error: `history must be an array of at most ${MAX_HISTORY_PAIRS} pairs` };
    }
    history = [];
    for (const pair of raw) {
      const ok = pair && typeof pair === "object" && Object.keys(pair).length === 2
        && typeof pair.question === "string" && typeof pair.answer === "string"
        && length(pair.question) <= MAX_HOSTED_QUESTION_LENGTH && length(pair.answer) <= MAX_HISTORY_ANSWER_LENGTH;
      if (!ok) {
        return { error: "history pairs must be { question, answer } within the length limits" };
      }
      history.push({ question: pair.question.trim(), answer: pair.answer.trim() });
    }
  }

  return { question, locale, knowledgeVersion, ...(context ? { context } : {}), ...(history?.length ? { history } : {}) };
}
