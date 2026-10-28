/*
 * Parses and validates src/assets/data/assistant-context.txt: short notes, written by the CV
 * owner in EN and PT, that the hosted AI answers may use for facts the JSON files don't hold
 * (see docs/ai-assistant-data.md). The local engine never reads them.
 *
 * Kept free of Angular and of runtime imports so that the validation script (run directly by
 * Node), the Cloud Function bundle and the Karma specs all share this one implementation.
 */
import type { Locale } from "../models/assistant.models";

export const CONTEXT_FILE = "assistant-context.txt";
export const MAX_NOTES = 30;
export const MAX_TITLE_LENGTH = 60;
export const MAX_TEXT_LENGTH = 600;
/** A cheap stand-in for the 1,500-token budget per locale; `snapshot:measure` gives the exact count. */
export const MAX_LOCALE_CHARACTERS = 5000;
export const STALE_WARNING_MONTHS = 12;
export const STALE_ERROR_MONTHS = 24;

const LOCALES: readonly Locale[] = ["en", "pt"];
const ID_LINE = /^\[([^\]]*)\]$/;
const NOTE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_LINE = /^([a-z.]+):\s?(.*)$/;
const MONTH = /^(\d{4})-(\d{2})$/;
const RELATED = /^exp\.(\d+)$/;
const FIELDS = ["updated", "related", "title.en", "title.pt", "en", "pt"] as const;
const REQUIRED_FIELDS = ["updated", "title.en", "title.pt", "en", "pt"] as const;

type Field = (typeof FIELDS)[number];

export interface YearMonth {
  readonly year: number;
  readonly month: number; // 1-12
}

export interface ContextNoteLocaleFields {
  readonly title: string;
  readonly text: string;
}

export interface ContextNote {
  readonly id: string;
  /** "YYYY-MM", as written. */
  readonly updated: string;
  /** Experience IDs the note is about; each one exists in experiences.json when IDs were supplied. */
  readonly related: readonly number[];
  readonly locales: Readonly<Record<Locale, ContextNoteLocaleFields>>;
  /** 1-based line of the note's `[id]`, for messages. */
  readonly line: number;
}

export interface ContextParseResult {
  readonly notes: readonly ContextNote[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface ContextParseOptions {
  /**
   * The current month, for the staleness rules. Left out at runtime (the function), where an
   * old note must not take the service down; the build and CI check age instead.
   */
  readonly today?: YearMonth;
  /** When given, every `related` entry must name one of these experiences. */
  readonly experienceIds?: readonly number[];
}

interface Draft {
  readonly id: string;
  readonly line: number;
  readonly fields: Map<Field, string>;
}

export function parseYearMonth(raw: string): YearMonth | null {
  const match = MONTH.exec(raw);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

function monthsBetween(from: YearMonth, to: YearMonth): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

/** Problems that make a title or text unsuitable for a plain-text, public notes file. */
export function contentProblems(text: string): string[] {
  const problems: string[] = [];
  if (/<\s*\/?\s*[a-zA-Z!]/.test(text) || /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i.test(text)) {
    problems.push("contains HTML");
  }
  if (/\[[^\]]*\]\([^)]*\)/.test(text) || /(^|\s)[*_`#>]{1,3}\S/.test(text)) {
    problems.push("contains Markdown");
  }
  if (/\bhttps?:\/\//i.test(text) || /\bwww\.[a-z0-9-]+\./i.test(text)) {
    problems.push("contains a URL");
  }
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)) {
    problems.push("contains an e-mail address");
  }
  for (const candidate of text.match(/\+?\d[\d\s().-]{6,}\d/g) ?? []) {
    if (candidate.replace(/\D/g, "").length >= 9) {
      problems.push("contains a phone number");
      break;
    }
  }
  return problems;
}

export function parseAssistantContext(source: string, options: ContextParseOptions): ContextParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const drafts: Draft[] = [];
  let current: Draft | null = null;

  source.replace(/^﻿/, "").split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === "") {
      current = null;
      return;
    }
    if (line.startsWith("#")) {
      return;
    }
    const idMatch = ID_LINE.exec(line);
    if (idMatch) {
      const id = idMatch[1].trim();
      if (!NOTE_ID.test(id)) {
        errors.push(`line ${lineNumber}: note id "${id}" must use lowercase letters, digits and single dashes`);
      } else if (drafts.some(d => d.id === id)) {
        errors.push(`line ${lineNumber}: note id "${id}" is used twice`);
      }
      current = { id, line: lineNumber, fields: new Map() };
      drafts.push(current);
      return;
    }
    const fieldMatch = FIELD_LINE.exec(line);
    if (!current) {
      errors.push(`line ${lineNumber}: text outside a note (start a note with a "[note-id]" line, or a comment with "#")`);
      return;
    }
    const draft: Draft = current;
    if (!fieldMatch) {
      errors.push(`line ${lineNumber}: expected "field: value" (a note can't continue over several lines)`);
      return;
    }
    const [, name, value] = fieldMatch;
    if (!(FIELDS as readonly string[]).includes(name)) {
      errors.push(`line ${lineNumber}: unknown field "${name}" (allowed: ${FIELDS.join(", ")})`);
      return;
    }
    if (draft.fields.has(name as Field)) {
      errors.push(`line ${lineNumber}: field "${name}" appears twice in note "${draft.id}"`);
      return;
    }
    draft.fields.set(name as Field, value.trim());
  });

  if (drafts.length > MAX_NOTES) {
    errors.push(`${drafts.length} notes; the limit is ${MAX_NOTES}`);
  }

  const notes: ContextNote[] = [];
  for (const draft of drafts) {
    const note = checkNote(draft, options, errors, warnings);
    if (note) {
      notes.push(note);
    }
  }

  for (const locale of LOCALES) {
    const characters = notes.reduce((sum, note) => sum + note.locales[locale].title.length + note.locales[locale].text.length, 0);
    if (characters > MAX_LOCALE_CHARACTERS) {
      errors.push(`the ${locale} notes total ${characters} characters; the limit is ${MAX_LOCALE_CHARACTERS}`);
    }
  }

  return { notes: errors.length ? [] : notes, errors, warnings };
}

function checkNote(draft: Draft, options: ContextParseOptions, errors: string[], warnings: string[]): ContextNote | null {
  const where = `note "${draft.id}" (line ${draft.line})`;
  const before = errors.length;
  const field = (name: Field): string => draft.fields.get(name) ?? "";

  for (const name of REQUIRED_FIELDS) {
    if (!field(name)) {
      errors.push(`${where}: "${name}" is required`);
    }
  }

  const updated = field("updated");
  if (updated) {
    const month = parseYearMonth(updated);
    if (!month) {
      errors.push(`${where}: "updated" must be YYYY-MM`);
    } else if (options.today) {
      const age = monthsBetween(month, options.today);
      if (age < 0) {
        errors.push(`${where}: "updated" ${updated} is in the future`);
      } else if (age > STALE_ERROR_MONTHS) {
        errors.push(`${where}: last updated ${updated}, over ${STALE_ERROR_MONTHS} months ago; review it and change "updated"`);
      } else if (age > STALE_WARNING_MONTHS) {
        warnings.push(`${where}: last updated ${updated}, over ${STALE_WARNING_MONTHS} months ago`);
      }
    }
  }

  const related: number[] = [];
  for (const entry of field("related").split(/[\s,]+/).filter(Boolean)) {
    const match = RELATED.exec(entry);
    if (!match) {
      errors.push(`${where}: related entry "${entry}" must look like exp.<id>`);
      continue;
    }
    const id = Number(match[1]);
    if (options.experienceIds && !options.experienceIds.includes(id)) {
      errors.push(`${where}: related experience ${id} is not in experiences.json`);
    } else if (!related.includes(id)) {
      related.push(id);
    }
  }

  for (const locale of LOCALES) {
    const title = field(`title.${locale}`);
    const text = field(locale);
    if (title.length > MAX_TITLE_LENGTH) {
      errors.push(`${where}: "title.${locale}" is ${title.length} characters; the limit is ${MAX_TITLE_LENGTH}`);
    }
    if (text.length > MAX_TEXT_LENGTH) {
      errors.push(`${where}: "${locale}" is ${text.length} characters; the limit is ${MAX_TEXT_LENGTH}`);
    }
    for (const [name, value] of [[`title.${locale}`, title], [locale, text]]) {
      for (const problem of contentProblems(value)) {
        errors.push(`${where}: "${name}" ${problem}`);
      }
    }
  }

  if (errors.length > before) {
    return null;
  }
  return {
    id: draft.id,
    updated,
    related,
    line: draft.line,
    locales: {
      en: { title: field("title.en"), text: field("en") },
      pt: { title: field("title.pt"), text: field("pt") }
    }
  };
}
