/*
 * Types shared by the CV assistant's knowledge adapter, answer engine, session store and UI.
 * Every fact the assistant can state is a SourcedText/SourcedDate/Excerpt taken from the loaded
 * JSON snapshot, carrying the JSON pointer it came from.
 */

export type Locale = "en" | "pt";
export const ASSISTANT_LOCALES: readonly Locale[] = ["en", "pt"];

/** The only files the assistant may use as knowledge (see docs/cv-assistant.md). */
export type SourceFile = "about.json" | "experiences.json" | "posts.json";

/** A plain-text value read from the JSON snapshot, with the JSON pointer it came from. */
export interface SourcedText {
  readonly value: string;
  readonly pointer: string;
}

/** A MM-DD-YYYY date from the JSON snapshot, parsed without the browser's Date parser. */
export interface SourcedDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly raw: string;
  readonly pointer: string;
}

/** Plain-text paragraphs converted from an HTML field (lines inside a paragraph are joined by "\n"). */
export interface Excerpt {
  readonly paragraphs: readonly string[];
  readonly pointer: string;
}

export interface MediaRecord {
  readonly title: SourcedText;
  readonly icon: SourcedText;
  /** Only present when the source URL parsed as http(s). */
  readonly url?: SourcedText;
}

export interface AboutRecord {
  readonly descriptions: Readonly<Partial<Record<Locale, Excerpt>>>;
  readonly medias: readonly MediaRecord[];
  readonly hobbies: readonly SourcedText[];
}

export interface ExperienceLocaleFields {
  readonly role: SourcedText;
  readonly description: Excerpt;
  readonly city?: SourcedText;
  readonly country?: SourcedText;
}

export interface ExperienceRecord {
  readonly id: number;
  readonly position: number;
  readonly companyName: SourcedText;
  readonly start: SourcedDate;
  /** Absent when the CV lists the role without an end date ("listed as ongoing"). */
  readonly end?: SourcedDate;
  readonly technologies: readonly SourcedText[];
  readonly locales: Readonly<Partial<Record<Locale, ExperienceLocaleFields>>>;
}

export interface PostLocaleFields {
  readonly title: SourcedText;
  readonly description: Excerpt;
}

export interface PostRecord {
  /** The post's unique source URL, used as its identity. */
  readonly key: string;
  readonly keyPointer: string;
  /** Only present when the source URL parsed as http(s). */
  readonly externalUrl?: string;
  readonly date: SourcedDate;
  readonly locales: Readonly<Partial<Record<Locale, PostLocaleFields>>>;
}

/** An immutable, validated copy of the three approved JSON files. */
export interface KnowledgeSnapshot {
  readonly about: AboutRecord;
  readonly experiences: readonly ExperienceRecord[];
  readonly posts: readonly PostRecord[];
}

/** Where an internal citation leads on the resume page. */
export type CitationTarget =
  | { readonly section: "about" }
  | { readonly section: "experience"; readonly experienceId: number }
  | { readonly section: "posts"; readonly postUrl: string };

export interface SourceRef {
  readonly file: SourceFile;
  /** "about", the experience ID, or the post's unique URL. */
  readonly recordKey: string;
  /** Exact JSON pointers (into `file`) of every field the answer used from this record. */
  readonly pointers: readonly string[];
  /** Localized, human-readable citation, e.g. "Experience · Swisscom AG". */
  readonly label: string;
  readonly target: CitationTarget;
  /** A validated http(s) URL from an approved field (post or profile link). */
  readonly externalUrl?: string;
}

/** One line of answer text: a fixed localized template whose slots were filled only with `facts`. */
export interface TemplateLine {
  readonly text: string;
  readonly facts: readonly SourcedText[];
}

export type AnswerBlock =
  | { readonly kind: "text"; readonly line: TemplateLine }
  | { readonly kind: "list"; readonly intro: TemplateLine; readonly items: readonly TemplateLine[] }
  | { readonly kind: "values"; readonly intro: TemplateLine; readonly values: readonly SourcedText[] }
  | { readonly kind: "excerpt"; readonly label: string; readonly excerpt: Excerpt };

export type IntentId =
  | "profile"
  | "employers"
  | "currentRole"
  | "companyOverview"
  | "companyRole"
  | "companyDates"
  | "companyLocation"
  | "technologies"
  | "technologyExperience"
  | "companyTechnologies"
  | "technologyAtCompany"
  | "posts"
  | "postSearch"
  | "postSummary"
  | "hobbies"
  | "socialLink"
  | "socialLinks";

export type FallbackReason =
  /** No reviewed pattern matches the whole question. */
  | "unrecognized"
  /** A pattern matched, but a slot (company, technology, ...) names nothing in the CV. */
  | "unknown-entity"
  /** More than one interpretation or record matched. */
  | "ambiguous"
  /** The question is understood but the fact is absent for the active locale. */
  | "missing-fact"
  /** A recognized search returned nothing. */
  | "no-results";

/** Why the assistant asks the visitor to pick a question instead of answering. */
export type ClarifyReason =
  /** A name was close to, but not exactly, a name in the CV ("Swiscom"). */
  | "typo"
  /** The question fits more than one record or reading. */
  | "ambiguous";

/**
 * The record a previous answer was about, so explicit follow-ups such as "And before that?" can
 * refer to it. It only identifies a record; facts are still read from the snapshot.
 */
export interface ConversationContext {
  readonly experienceId?: number;
}

export type AnswerResult =
  | {
      readonly kind: "answered";
      readonly intent: IntentId;
      readonly blocks: readonly AnswerBlock[];
      readonly sources: readonly SourceRef[];
      /** Supported questions offered as explicit follow-ups (each one answers on this snapshot). */
      readonly followUps: readonly string[];
      /** The single experience this answer was about, if any (becomes the next question's context). */
      readonly subject?: ConversationContext;
    }
  | {
      readonly kind: "clarify";
      readonly reason: ClarifyReason;
      /** Supported questions the visitor may have meant; each one answers on this snapshot. */
      readonly options: readonly string[];
    }
  | { readonly kind: "fallback"; readonly reason: FallbackReason }
  | { readonly kind: "unavailable" };

export type QuestionError = "empty" | "too-long";
