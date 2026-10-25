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

/**
 * Edits (insert, delete, substitute, swap two neighbours) tolerated between a visitor's name and a
 * CV name of this length. Short names get none, so "js", "ts", "c#" or "java" never drift to
 * another technology.
 */
export function typoTolerance(length: number): number {
  return length < 4 ? 0 : length < 8 ? 1 : 2;
}

/**
 * Optimal-string-alignment distance between a and b, or Infinity once it exceeds max (the
 * computation stops early, so comparing against every CV name stays cheap).
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) {
    return Infinity;
  }
  let previousRow: number[] = [];
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previousRow[j - 2] + 1);
      }
      next.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) {
      return Infinity;
    }
    previousRow = row;
    row = next;
  }
  return row[b.length] <= max ? row[b.length] : Infinity;
}
