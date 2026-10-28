/*
 * Types shared by the CV assistant's knowledge adapter, answer engine, session store and UI.
 * Every fact the assistant can state is a SourcedText/SourcedDate/Excerpt taken from the loaded
 * JSON snapshot, carrying the JSON pointer it came from.
 */

export type Locale = "en" | "pt";
export const ASSISTANT_LOCALES: readonly Locale[] = ["en", "pt"];

/**
 * The only files the assistant may use as knowledge (see docs/ai-assistant-data.md). The local
 * engine reads the JSON files; assistant-context.txt is read only by the hosted AI answers.
 */
export type SourceFile = "about.json" | "experiences.json" | "posts.json" | "assistant-context.txt";

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

/** A YYYY or MM-YYYY value (education years, certificate dates), kept at the precision the CV gives. */
export interface SourcedPartialDate {
  readonly year: number;
  /** 1-12; absent when the CV gives only a year. */
  readonly month?: number;
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

export interface EducationLocaleFields {
  readonly degree: SourcedText;
  readonly field?: SourcedText;
}

export interface EducationRecord {
  readonly school: SourcedText;
  readonly start?: SourcedPartialDate;
  readonly end?: SourcedPartialDate;
  readonly locales: Readonly<Partial<Record<Locale, EducationLocaleFields>>>;
}

/** A professional certification exam, a course-completion certificate, or a program badge. */
export type CertificationType = "certification" | "course" | "badge";
export const CERTIFICATION_TYPES: readonly CertificationType[] = ["certification", "course", "badge"];

export interface CertificationRecord {
  /** JSON pointer of the record ("/certifications/3"), used as its identity in citations. */
  readonly pointer: string;
  readonly name: SourcedText;
  readonly issuer: SourcedText;
  readonly type: SourcedText & { readonly value: CertificationType };
  readonly issued: SourcedPartialDate;
  /** Absent when the CV lists no expiry date (which does not confirm current validity). */
  readonly expires?: SourcedPartialDate;
  /** Only present when the source URL parsed as http(s). */
  readonly url?: SourcedText;
}

export interface LanguageLocaleFields {
  readonly name: SourcedText;
  /** The self-reported level, exactly as the CV words it. */
  readonly proficiency: SourcedText;
}

export interface LanguageRecord {
  readonly code: SourcedText;
  readonly locales: Readonly<Partial<Record<Locale, LanguageLocaleFields>>>;
}

export interface TopicLocaleFields {
  readonly name: SourcedText;
  readonly summary: Excerpt;
}

/** A summary written for the CV about one area of work, linked to the experiences it covers. */
export interface TopicRecord {
  readonly id: SourcedText;
  /** Extra wordings (either language) that name this topic in a question. */
  readonly aliases: readonly SourcedText[];
  readonly experienceIds: readonly number[];
  readonly locales: Readonly<Partial<Record<Locale, TopicLocaleFields>>>;
}

export interface AboutRecord {
  readonly descriptions: Readonly<Partial<Record<Locale, Excerpt>>>;
  readonly medias: readonly MediaRecord[];
  readonly hobbies: readonly SourcedText[];
  readonly education: readonly EducationRecord[];
  readonly certifications: readonly CertificationRecord[];
  readonly languages: readonly LanguageRecord[];
  readonly topics: readonly TopicRecord[];
}

export interface ExperienceLocaleFields {
  readonly role: SourcedText;
  readonly description: Excerpt;
  readonly city?: SourcedText;
  readonly country?: SourcedText;
  /** Short result bullets for the role; empty when the CV lists none. */
  readonly highlights: readonly SourcedText[];
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
  | { readonly section: "posts"; readonly postUrl: string }
  /** A note from assistant-context.txt: shown as a label, with nothing on the page to link to. */
  | { readonly section: "notes"; readonly noteId: string };

export interface SourceRef {
  readonly file: SourceFile;
  /** "about", a certification's JSON pointer, the experience ID, or the post's unique URL. */
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
  | "socialLinks"
  | "education"
  | "certifications"
  | "issuerCertifications"
  | "languages"
  | "languageProficiency"
  | "topicSummary"
  | "companyHighlights";

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

/**
 * A question the local engine couldn't answer, handed to the hosted AI answers (the askAssistant
 * Cloud Function). Kept apart from AnswerResult: generated prose is never a TemplateLine, and its
 * citations come from the evidence the model cited, not from template slots.
 */
export enum HostedAnswerKind {
  Pending = "pending",
  Generated = "generated",
  /** Hosted answers are off, over a limit, or failed; the UI says so and offers Contact. */
  Unavailable = "ai-unavailable",
  /** The page's CV data differs from the function's (a deploy happened); the UI offers a reload. */
  VersionMismatch = "version-mismatch"
}

export type HostedAnswer =
  | { readonly kind: HostedAnswerKind.Pending }
  | {
      readonly kind: HostedAnswerKind.Generated;
      /** Plain text, shown as text (never as HTML). */
      readonly paragraphs: readonly string[];
      readonly sources: readonly SourceRef[];
      /** Part of the question isn't covered; the UI adds the fixed "not covered" line. */
      readonly partial: boolean;
      /** Whether a note from assistant-context.txt was cited (changes the AI label). */
      readonly usesNotes: boolean;
      readonly subject?: ConversationContext;
    }
  | { readonly kind: HostedAnswerKind.Unavailable }
  | { readonly kind: HostedAnswerKind.VersionMismatch };

/** What a conversation pair shows: a local engine result or a hosted answer. */
export type PairAnswer = AnswerResult | HostedAnswer;
