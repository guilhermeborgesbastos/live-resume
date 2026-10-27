/*
 * Validates the raw about/experiences/posts JSON and converts it into an immutable
 * KnowledgeSnapshot whose every value carries its JSON pointer. Any structural problem rejects
 * the whole snapshot (the assistant then reports itself unavailable instead of answering from a
 * partial dataset). Optional fields that are absent stay absent; unsafe link schemes are dropped.
 */
import {
  AboutRecord, ASSISTANT_LOCALES, CERTIFICATION_TYPES, CertificationRecord, CertificationType, EducationLocaleFields,
  EducationRecord, Excerpt, ExperienceLocaleFields, ExperienceRecord, KnowledgeSnapshot, LanguageLocaleFields,
  LanguageRecord, Locale, MediaRecord, PostLocaleFields, PostRecord, SourcedDate, SourcedPartialDate, SourcedText,
  TopicLocaleFields, TopicRecord
} from "../models/assistant.models";
import { htmlToLine, htmlToParagraphs } from "./plain-text";

export class KnowledgeValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid CV data: ${issues.join("; ")}`);
    this.name = "KnowledgeValidationError";
  }
}

export interface RawKnowledge {
  about: unknown;
  experiences: unknown;
  posts: unknown;
}

type JsonObject = Record<string, unknown>;

const DATE_FORMAT = /^(\d{2})-(\d{2})-(\d{4})$/;
const PARTIAL_DATE_FORMAT = /^(?:(\d{2})-)?(\d{4})$/;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Parses MM-DD-YYYY explicitly; returns undefined for anything else, including impossible dates. */
export function parseCvDate(raw: unknown, pointer: string): SourcedDate | undefined {
  const match = typeof raw === "string" ? DATE_FORMAT.exec(raw) : null;
  if (!match) {
    return undefined;
  }
  const [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return undefined;
  }
  return { year, month, day, raw: raw as string, pointer };
}

export function compareDates(a: SourcedDate, b: SourcedDate): number {
  return (a.year - b.year) || (a.month - b.month) || (a.day - b.day);
}

/** Parses YYYY or MM-YYYY; returns undefined for anything else. */
export function parsePartialDate(raw: unknown, pointer: string): SourcedPartialDate | undefined {
  const match = typeof raw === "string" ? PARTIAL_DATE_FORMAT.exec(raw) : null;
  if (!match) {
    return undefined;
  }
  const year = Number(match[2]);
  if (match[1] === undefined) {
    return { year, raw: raw as string, pointer };
  }
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? { year, month, raw: raw as string, pointer } : undefined;
}

/** Orders partial dates; a year-only value sorts before any month of that year. */
export function comparePartialDates(a: SourcedPartialDate, b: SourcedPartialDate): number {
  return (a.year - b.year) || ((a.month ?? 0) - (b.month ?? 0));
}

/** Accepts only absolute http(s) URLs. */
export function safeExternalUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Recursively freezes the snapshot so no consumer (e.g. a sort) can change assistant results. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

class Validator {
  readonly issues: string[] = [];

  fail(pointer: string, problem: string): void {
    this.issues.push(`${pointer || "/"} ${problem}`);
  }

  text(owner: JsonObject, key: string, pointer: string, required: boolean, html = false): SourcedText | undefined {
    const raw = owner[key];
    const fieldPointer = `${pointer}/${key}`;
    if (raw === undefined || raw === null) {
      if (required) {
        this.fail(fieldPointer, "is required");
      }
      return undefined;
    }
    if (typeof raw !== "string") {
      this.fail(fieldPointer, "must be a string");
      return undefined;
    }
    const value = html ? htmlToLine(raw) : raw.replace(/\s+/g, " ").trim();
    if (!value) {
      if (required) {
        this.fail(fieldPointer, "must not be empty");
      }
      return undefined;
    }
    return { value, pointer: fieldPointer };
  }

  excerpt(owner: JsonObject, key: string, pointer: string): Excerpt | undefined {
    const raw = owner[key];
    const fieldPointer = `${pointer}/${key}`;
    const paragraphs = typeof raw === "string" ? htmlToParagraphs(raw) : [];
    if (paragraphs.length === 0) {
      this.fail(fieldPointer, "must be a non-empty string");
      return undefined;
    }
    return { paragraphs, pointer: fieldPointer };
  }

  date(owner: JsonObject, key: string, pointer: string, required: boolean): SourcedDate | undefined {
    const fieldPointer = `${pointer}/${key}`;
    if (owner[key] === undefined || owner[key] === null) {
      if (required) {
        this.fail(fieldPointer, "is required");
      }
      return undefined;
    }
    const date = parseCvDate(owner[key], fieldPointer);
    if (!date) {
      this.fail(fieldPointer, "must be a valid MM-DD-YYYY date");
    }
    return date;
  }

  partialDate(owner: JsonObject, key: string, pointer: string, required: boolean): SourcedPartialDate | undefined {
    const fieldPointer = `${pointer}/${key}`;
    if (owner[key] === undefined || owner[key] === null) {
      if (required) {
        this.fail(fieldPointer, "is required");
      }
      return undefined;
    }
    const date = parsePartialDate(owner[key], fieldPointer);
    if (!date) {
      this.fail(fieldPointer, "must be a valid YYYY or MM-YYYY date");
    }
    return date;
  }

  /** An optional array of non-empty strings, each converted from inert HTML to one plain line. */
  lines(owner: JsonObject, key: string, pointer: string): SourcedText[] {
    const lines: SourcedText[] = [];
    this.array(owner, key, pointer, false).forEach((raw, index) => {
      const itemPointer = `${pointer}/${key}/${index}`;
      const value = typeof raw === "string" ? htmlToLine(raw) : "";
      if (!value) {
        this.fail(itemPointer, "must be a non-empty string");
        return;
      }
      lines.push({ value, pointer: itemPointer });
    });
    return lines;
  }

  /** Reads the optional `key` array of objects, calling `read` for each valid object. */
  records<T>(owner: JsonObject, key: string, read: (item: JsonObject, pointer: string) => T | undefined): T[] {
    const records: T[] = [];
    this.array(owner, key, "", false).forEach((item, index) => {
      const pointer = `/${key}/${index}`;
      if (!isObject(item)) {
        this.fail(pointer, "must be an object");
        return;
      }
      const record = read(item, pointer);
      if (record !== undefined) {
        records.push(record);
      }
    });
    return records;
  }

  array(owner: JsonObject, key: string, pointer: string, required: boolean): unknown[] {
    const raw = owner[key];
    if (raw === undefined || raw === null) {
      if (required) {
        this.fail(`${pointer}/${key}`, "is required");
      }
      return [];
    }
    if (!Array.isArray(raw)) {
      this.fail(`${pointer}/${key}`, "must be an array");
      return [];
    }
    return raw;
  }

  /**
   * Maps each site locale to its entry in `internationalizations`, keeping the entry's real array
   * index for the pointers. Both locales are required; duplicates and unknown languages are errors.
   */
  locales<T>(owner: JsonObject, pointer: string, read: (entry: JsonObject, entryPointer: string) => T | undefined): Partial<Record<Locale, T>> {
    const result: Partial<Record<Locale, T>> = {};
    const seen = new Set<string>();
    this.array(owner, "internationalizations", pointer, true).forEach((entry, index) => {
      const entryPointer = `${pointer}/internationalizations/${index}`;
      if (!isObject(entry)) {
        this.fail(entryPointer, "must be an object");
        return;
      }
      const language = entry["language"];
      if (language !== "en" && language !== "pt") {
        this.fail(`${entryPointer}/language`, "must be \"en\" or \"pt\"");
        return;
      }
      if (seen.has(language)) {
        this.fail(`${entryPointer}/language`, `duplicates "${language}"`);
        return;
      }
      seen.add(language);
      const value = read(entry, entryPointer);
      if (value !== undefined) {
        result[language] = value;
      }
    });
    ASSISTANT_LOCALES.filter(locale => !seen.has(locale))
      .forEach(locale => this.fail(`${pointer}/internationalizations`, `has no "${locale}" entry`));
    return result;
  }
}

function adaptAbout(raw: unknown, v: Validator): AboutRecord | undefined {
  if (!isObject(raw)) {
    v.fail("about.json", "must be an object");
    return undefined;
  }
  const descriptions = v.locales<Excerpt>(raw, "", (entry, entryPointer) => v.excerpt(entry, "description", entryPointer));

  const medias: MediaRecord[] = [];
  v.array(raw, "medias", "", false).forEach((media, index) => {
    const pointer = `/medias/${index}`;
    if (!isObject(media)) {
      v.fail(pointer, "must be an object");
      return;
    }
    const title = v.text(media, "title", pointer, true);
    const icon = v.text(media, "icon", pointer, true);
    const http = v.text(media, "http", pointer, true);
    const url = safeExternalUrl(http?.value);
    if (title && icon) {
      medias.push({ title, icon, ...(url && http ? { url: { value: url, pointer: http.pointer } } : {}) });
    }
  });

  const hobbies: SourcedText[] = [];
  v.array(raw, "hobbies", "", false).forEach((hobby, index) => {
    const pointer = `/hobbies/${index}`;
    if (!isObject(hobby)) {
      v.fail(pointer, "must be an object");
      return;
    }
    const title = v.text(hobby, "title", pointer, true);
    if (title) {
      hobbies.push(title);
    }
  });

  const education = v.records<EducationRecord>(raw, "education", (item, pointer) => {
    const school = v.text(item, "school", pointer, true, true);
    const start = v.partialDate(item, "startAt", pointer, false);
    const end = v.partialDate(item, "endAt", pointer, false);
    if (start && end && comparePartialDates(end, start) < 0) {
      v.fail(`${pointer}/endAt`, "is before startAt");
    }
    const locales = v.locales<EducationLocaleFields>(item, pointer, (entry, entryPointer) => {
      const degree = v.text(entry, "degree", entryPointer, true, true);
      const field = v.text(entry, "fieldOfStudy", entryPointer, false, true);
      return degree ? { degree, ...(field ? { field } : {}) } : undefined;
    });
    return school ? { school, ...(start ? { start } : {}), ...(end ? { end } : {}), locales } : undefined;
  });

  const certifications = v.records<CertificationRecord>(raw, "certifications", (item, pointer) => {
    const name = v.text(item, "name", pointer, true, true);
    const issuer = v.text(item, "issuer", pointer, true, true);
    const type = v.text(item, "type", pointer, true);
    if (type && !CERTIFICATION_TYPES.includes(type.value as CertificationType)) {
      v.fail(type.pointer, `must be one of ${CERTIFICATION_TYPES.join(", ")}`);
    }
    const issued = v.partialDate(item, "issuedAt", pointer, true);
    const expires = v.partialDate(item, "expiresAt", pointer, false);
    if (issued && expires && comparePartialDates(expires, issued) < 0) {
      v.fail(`${pointer}/expiresAt`, "is before issuedAt");
    }
    const http = v.text(item, "url", pointer, false);
    const url = safeExternalUrl(http?.value);
    if (!name || !issuer || !type || !CERTIFICATION_TYPES.includes(type.value as CertificationType) || !issued) {
      return undefined;
    }
    return {
      pointer, name, issuer, type: type as CertificationRecord["type"], issued,
      ...(expires ? { expires } : {}),
      ...(url && http ? { url: { value: url, pointer: http.pointer } } : {})
    };
  });

  const languageCodes = new Set<string>();
  const languages = v.records<LanguageRecord>(raw, "languages", (item, pointer) => {
    const code = v.text(item, "code", pointer, true);
    if (code && languageCodes.has(code.value)) {
      v.fail(code.pointer, `duplicates language "${code.value}"`);
    } else if (code) {
      languageCodes.add(code.value);
    }
    const locales = v.locales<LanguageLocaleFields>(item, pointer, (entry, entryPointer) => {
      const name = v.text(entry, "name", entryPointer, true, true);
      const proficiency = v.text(entry, "proficiency", entryPointer, true, true);
      return name && proficiency ? { name, proficiency } : undefined;
    });
    return code ? { code, locales } : undefined;
  });

  const topicIds = new Set<string>();
  const topics = v.records<TopicRecord>(raw, "topics", (item, pointer) => {
    const id = v.text(item, "id", pointer, true);
    if (id && topicIds.has(id.value)) {
      v.fail(id.pointer, `duplicates topic "${id.value}"`);
    } else if (id) {
      topicIds.add(id.value);
    }
    const aliases = v.lines(item, "aliases", pointer);
    const experienceIds: number[] = [];
    v.array(item, "experienceIds", pointer, true).forEach((experienceId, index) => {
      if (typeof experienceId !== "number" || !Number.isInteger(experienceId)) {
        v.fail(`${pointer}/experienceIds/${index}`, "must be an integer");
      } else if (!experienceIds.includes(experienceId)) {
        experienceIds.push(experienceId);
      }
    });
    if (experienceIds.length === 0) {
      v.fail(`${pointer}/experienceIds`, "must list at least one experience");
    }
    const locales = v.locales<TopicLocaleFields>(item, pointer, (entry, entryPointer) => {
      const name = v.text(entry, "name", entryPointer, true, true);
      const summary = v.excerpt(entry, "summary", entryPointer);
      return name && summary ? { name, summary } : undefined;
    });
    return id ? { id, aliases, experienceIds, locales } : undefined;
  });

  return { descriptions, medias, hobbies, education, certifications, languages, topics };
}

/** Topics may only point at experiences that exist. */
function checkTopicLinks(about: AboutRecord, experiences: readonly ExperienceRecord[], v: Validator): void {
  const ids = new Set(experiences.map(e => e.id));
  about.topics.forEach((topic, index) => topic.experienceIds
    .filter(id => !ids.has(id))
    .forEach(id => v.fail(`/topics/${index}/experienceIds`, `names unknown experience ID ${id}`)));
}

function adaptExperiences(raw: unknown, v: Validator): ExperienceRecord[] {
  if (!Array.isArray(raw)) {
    v.fail("experiences.json", "must be an array");
    return [];
  }
  const ids = new Set<number>();
  const records: ExperienceRecord[] = [];
  raw.forEach((item, index) => {
    const pointer = `/${index}`;
    if (!isObject(item)) {
      v.fail(pointer, "must be an object");
      return;
    }
    const id = item["id"];
    if (typeof id !== "number" || !Number.isInteger(id) || id < 0) {
      v.fail(`${pointer}/id`, "must be a non-negative integer");
    } else if (ids.has(id)) {
      v.fail(`${pointer}/id`, `duplicates experience ID ${id}`);
    } else {
      ids.add(id);
    }
    const position = item["position"];
    if (typeof position !== "number" || !Number.isInteger(position)) {
      v.fail(`${pointer}/position`, "must be an integer");
    }
    const companyName = v.text(item, "companyName", pointer, true);
    const start = v.date(item, "startAt", pointer, true);
    const end = v.date(item, "endAt", pointer, false);
    if (start && end && compareDates(end, start) < 0) {
      v.fail(`${pointer}/endAt`, "is before startAt");
    }
    const technologies: SourcedText[] = [];
    v.array(item, "technologies", pointer, false).forEach((technology, techIndex) => {
      const techPointer = `${pointer}/technologies/${techIndex}`;
      if (!isNonEmptyString(technology)) {
        v.fail(techPointer, "must be a non-empty string");
        return;
      }
      technologies.push({ value: technology.trim(), pointer: techPointer });
    });
    const locales = v.locales<ExperienceLocaleFields>(item, pointer, (entry, entryPointer) => {
      const role = v.text(entry, "role", entryPointer, true, true);
      const description = v.excerpt(entry, "description", entryPointer);
      const city = v.text(entry, "city", entryPointer, false, true);
      const country = v.text(entry, "country", entryPointer, false, true);
      const highlights = v.lines(entry, "highlights", entryPointer);
      if (!role || !description) {
        return undefined;
      }
      return { role, description, ...(city ? { city } : {}), ...(country ? { country } : {}), highlights };
    });
    if (typeof id === "number" && typeof position === "number" && companyName && start) {
      records.push({ id, position, companyName, start, ...(end ? { end } : {}), technologies, locales });
    }
  });
  return records;
}

function adaptPosts(raw: unknown, v: Validator): PostRecord[] {
  if (!Array.isArray(raw)) {
    v.fail("posts.json", "must be an array");
    return [];
  }
  const urls = new Set<string>();
  const records: PostRecord[] = [];
  raw.forEach((item, index) => {
    const pointer = `/${index}`;
    if (!isObject(item)) {
      v.fail(pointer, "must be an object");
      return;
    }
    const http = item["http"];
    if (!isNonEmptyString(http)) {
      v.fail(`${pointer}/http`, "must be a non-empty string");
    } else if (urls.has(http)) {
      v.fail(`${pointer}/http`, "duplicates another post's URL");
    } else {
      urls.add(http);
    }
    const date = v.date(item, "date", pointer, true);
    const locales = v.locales<PostLocaleFields>(item, pointer, (entry, entryPointer) => {
      const title = v.text(entry, "title", entryPointer, true, true);
      const description = v.excerpt(entry, "description", entryPointer);
      return title && description ? { title, description } : undefined;
    });
    if (isNonEmptyString(http) && date) {
      const externalUrl = safeExternalUrl(http);
      records.push({ key: http, keyPointer: `${pointer}/http`, ...(externalUrl ? { externalUrl } : {}), date, locales });
    }
  });
  return records;
}

/** Validates the three raw files and returns a frozen snapshot, or throws KnowledgeValidationError. */
export function adaptKnowledge(raw: RawKnowledge): KnowledgeSnapshot {
  const about = new Validator();
  const experiences = new Validator();
  const posts = new Validator();
  const snapshot = {
    about: adaptAbout(raw.about, about),
    experiences: adaptExperiences(raw.experiences, experiences),
    posts: adaptPosts(raw.posts, posts)
  };
  if (snapshot.about) {
    checkTopicLinks(snapshot.about, snapshot.experiences, about);
  }
  const prefix = (file: string) => (issue: string) => issue.startsWith(file) ? issue : `${file} ${issue}`;
  const issues = [
    ...about.issues.map(prefix("about.json")),
    ...experiences.issues.map(prefix("experiences.json")),
    ...posts.issues.map(prefix("posts.json"))
  ];
  if (issues.length > 0 || !snapshot.about) {
    throw new KnowledgeValidationError(issues);
  }
  return deepFreeze({ ...snapshot, about: snapshot.about });
}
