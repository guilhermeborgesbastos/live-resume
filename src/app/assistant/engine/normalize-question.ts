import { QuestionError } from "../models/assistant.models";

export const MAX_QUESTION_LENGTH = 500;

export type QuestionValidation =
  | { readonly ok: true; readonly question: string }
  | { readonly ok: false; readonly error: QuestionError };

/** Accepts 1-500 Unicode code points after trimming; longer input is rejected, never truncated. */
export function validateQuestion(raw: string): QuestionValidation {
  const question = (raw ?? "").trim();
  const length = [...question].length;
  if (length === 0) {
    return { ok: false, error: "empty" };
  }
  if (length > MAX_QUESTION_LENGTH) {
    return { ok: false, error: "too-long" };
  }
  return { ok: true, question };
}

/**
 * Case-, accent- and typography-insensitive form used for matching (never for display).
 * Technology punctuation such as "C++", "C#", ".NET", "Node.js" and "CI/CD" is kept.
 */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’‛ʼ´`]/g, "'")
    .replace(/[“”„«»]/g, "\"")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** The folded question without leading inverted marks and permitted terminal punctuation. */
export function normalizeUtterance(question: string): string {
  return foldText(question)
    .replace(/^[¿¡]+\s*/, "")
    .replace(/\s*[?!.…]+$/, "")
    .replace(/\s+([,;])/g, "$1")
    .trim();
}

/** Compact key for entity names: letters and digits only ("E-tática" -> "etatica"). */
export function entityKey(text: string): string {
  return foldText(text).replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Key for technology names: folded, single-spaced, with technology punctuation kept. */
export function technologyKey(text: string): string {
  return foldText(text).replace(/\s*([/()])\s*/g, "$1").replace(/\s+/g, " ").trim();
}

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}+#]*(?:[.\-/][\p{L}\p{N}+#]+)*/gu;

/** Whole-word tokens for post search ("node.js" and "c++" stay single tokens). */
export function tokenize(text: string): string[] {
  return foldText(text).match(TOKEN) ?? [];
}
