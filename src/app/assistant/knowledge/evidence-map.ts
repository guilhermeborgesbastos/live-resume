/*
 * The CV as the hosted model sees it: one evidence entry per group of facts, each with a stable
 * ID ("exp.6.tech", "post.1a2b3c4d", "ctx.java-experience"), the plain text the model reads, and
 * the citation it becomes. The Cloud Function builds the prompt and the closed list of evidence
 * IDs from this; the browser turns the IDs of a validated answer back into SourceRefs. Pure: no
 * Angular, no DOM, so both sides bundle the same code.
 *
 * IDs come from record identities (experience id, post URL, topic id, language code, names),
 * never from array positions, so adding a post or a certificate doesn't renumber anything.
 */
import { ANSWER_TEMPLATES, AnswerTemplates, formatMonthYear, formatPartialDate } from "../engine/answer-templates";
import { byDateDescending, byStartDescending } from "../engine/compose-answer";
import { Excerpt, ExperienceRecord, KnowledgeSnapshot, Locale, SourceRef } from "../models/assistant.models";
import { ContextNote, parseYearMonth } from "./assistant-context";
import { RawKnowledge } from "./knowledge-adapter";

/** Bump when the evidence IDs or texts change shape, so browser and function never mix versions. */
export const EVIDENCE_FORMAT_VERSION = 1;

export interface EvidenceEntry {
  readonly id: string;
  /** Plain text the model reads after the "[id]" marker; every fact in it comes from the CV or a note. */
  readonly text: string;
  /** The citation shown when an answer cites this entry. */
  readonly source: SourceRef;
  /** Further citations that come with this one (a note's related experiences). */
  readonly relatedSources: readonly SourceRef[];
  /** The experience this entry is about, if exactly one. */
  readonly experienceId?: number;
}

export interface EvidenceMap {
  readonly locale: Locale;
  readonly entries: readonly EvidenceEntry[];
  readonly byId: ReadonlyMap<string, EvidenceEntry>;
}

/** 32-bit FNV-1a, hex. Short, stable IDs for long keys such as post URLs; not for security. */
export function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function slug(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
}

const excerptText = (excerpt: Excerpt): string => excerpt.paragraphs.map(p => p.replace(/\n/g, " ")).join(" ");

class Builder {
  readonly entries: EvidenceEntry[] = [];
  private readonly t: AnswerTemplates;

  constructor(private readonly locale: Locale) {
    this.t = ANSWER_TEMPLATES[locale];
  }

  add(id: string, text: string, source: SourceRef, extra: Partial<Pick<EvidenceEntry, "relatedSources" | "experienceId">> = {}): void {
    let unique = id;
    for (let n = 2; this.entries.some(e => e.id === unique); n++) {
      unique = `${id}-${n}`;
    }
    this.entries.push({ id: unique, text: text.replace(/\s+/g, " ").trim(), source, relatedSources: extra.relatedSources ?? [], ...extra });
  }

  aboutSource(pointers: string[], externalUrl?: string): SourceRef {
    return { file: "about.json", recordKey: "about", pointers, label: this.t.labels.about, target: { section: "about" }, ...(externalUrl ? { externalUrl } : {}) };
  }

  experienceSource(experience: ExperienceRecord, pointers: string[]): SourceRef {
    return {
      file: "experiences.json",
      recordKey: String(experience.id),
      pointers: [experience.companyName.pointer, ...pointers],
      label: this.t.labels.experience(experience.companyName.value),
      target: { section: "experience", experienceId: experience.id }
    };
  }

  range(experience: ExperienceRecord): string {
    const start = formatMonthYear(experience.start, this.locale);
    return experience.end ? `${start} – ${formatMonthYear(experience.end, this.locale)}` : `${start} – ${this.t.snapshot.ongoing}`;
  }
}

/**
 * Builds the evidence for one locale. Records without fields in that locale are left out, so a
 * fact that exists only in the other language can't be used. `notes` must already be validated.
 */
export function buildEvidenceMap(snapshot: KnowledgeSnapshot, notes: readonly ContextNote[], locale: Locale): EvidenceMap {
  const b = new Builder(locale);
  const t = ANSWER_TEMPLATES[locale];
  const about = snapshot.about;

  const description = about.descriptions[locale];
  if (description) {
    b.add("about.description", excerptText(description), b.aboutSource([description.pointer]));
  }
  if (about.hobbies.length) {
    const titles = about.hobbies.map(h => t.hobbyTitles?.[h.value] ?? h.value);
    b.add("about.hobbies", `${t.snapshot.hobbies}: ${titles.join(", ")}`, b.aboutSource(about.hobbies.map(h => h.pointer)));
  }
  const profiles = about.medias.filter(m => m.url);
  if (profiles.length) {
    b.add("about.profiles", `${t.snapshot.profiles}: ${profiles.map(m => m.title.value).join(", ")}`,
      b.aboutSource(profiles.flatMap(m => [m.title.pointer, m.url!.pointer])));
  }

  for (const education of about.education) {
    const fields = education.locales[locale];
    if (!fields) {
      continue;
    }
    const period = [education.start, education.end].filter(d => d).map(d => formatPartialDate(d!, locale)).join(" – ");
    const facts = [fields.degree.value, fields.field?.value, education.school.value, period].filter(Boolean);
    const pointers = [education.school.pointer, fields.degree.pointer, ...(fields.field ? [fields.field.pointer] : []),
      ...[education.start, education.end].filter(d => d).map(d => d!.pointer)];
    b.add(`edu.${slug(education.school.value)}`, facts.join(" · "), b.aboutSource(pointers));
  }

  for (const certification of about.certifications) {
    const dates = [`${t.snapshot.issued} ${formatPartialDate(certification.issued, locale)}`,
      ...(certification.expires ? [`${t.snapshot.expires} ${formatPartialDate(certification.expires, locale)}`] : [])];
    b.add(`cert.${slug(certification.name.value)}`,
      [certification.name.value, t.certificationTypes[certification.type.value], certification.issuer.value, ...dates].join(" · "),
      {
        file: "about.json",
        recordKey: certification.pointer,
        pointers: [certification.name.pointer, certification.issuer.pointer, certification.issued.pointer],
        label: certification.name.value,
        target: { section: "about" },
        ...(certification.url ? { externalUrl: certification.url.value } : {})
      });
  }

  for (const language of about.languages) {
    const fields = language.locales[locale];
    if (fields) {
      b.add(`lang.${slug(language.code.value)}`, `${fields.name.value}: ${fields.proficiency.value}`,
        b.aboutSource([fields.name.pointer, fields.proficiency.pointer]));
    }
  }

  const experiences = [...snapshot.experiences].sort(byStartDescending);
  const byExperienceId = new Map(experiences.map(e => [e.id, e]));

  for (const topic of about.topics) {
    const fields = topic.locales[locale];
    if (!fields) {
      continue;
    }
    const companies = topic.experienceIds.map(id => byExperienceId.get(id)?.companyName.value).filter(Boolean);
    b.add(`topic.${slug(topic.id.value)}`,
      `${fields.name.value}: ${excerptText(fields.summary)} (${t.snapshot.roles}: ${companies.join(", ")})`,
      b.aboutSource([fields.name.pointer, fields.summary.pointer]));
  }

  for (const experience of experiences) {
    const fields = experience.locales[locale];
    if (!fields) {
      continue;
    }
    const company = experience.companyName.value;
    const place = [fields.city?.value, fields.country?.value].filter(Boolean).join(", ");
    const dates = [experience.start.pointer, ...(experience.end ? [experience.end.pointer] : [])];
    const one = { experienceId: experience.id };
    b.add(`exp.${experience.id}`, [company, fields.role.value, b.range(experience), place].filter(Boolean).join(" · "),
      b.experienceSource(experience, [fields.role.pointer, ...dates,
        ...(fields.city ? [fields.city.pointer] : []), ...(fields.country ? [fields.country.pointer] : [])]), one);
    if (experience.technologies.length) {
      b.add(`exp.${experience.id}.tech`, `${company} ${t.snapshot.technologies}: ${experience.technologies.map(x => x.value).join(", ")}`,
        b.experienceSource(experience, experience.technologies.map(x => x.pointer)), one);
    }
    b.add(`exp.${experience.id}.desc`, `${company}: ${excerptText(fields.description)}`,
      b.experienceSource(experience, [fields.description.pointer]), one);
    if (fields.highlights.length) {
      b.add(`exp.${experience.id}.hl`, `${company} ${t.snapshot.highlights}: ${fields.highlights.map(h => h.value).join(" | ")}`,
        b.experienceSource(experience, fields.highlights.map(h => h.pointer)), one);
    }
  }

  for (const post of [...snapshot.posts].sort(byDateDescending)) {
    const fields = post.locales[locale];
    if (!fields) {
      continue;
    }
    b.add(`post.${stableHash(post.key)}`,
      `${fields.title.value} (${formatMonthYear(post.date, locale)}): ${excerptText(fields.description)}`,
      {
        file: "posts.json",
        recordKey: post.key,
        pointers: [fields.title.pointer, post.date.pointer, fields.description.pointer],
        label: fields.title.value,
        target: { section: "posts", postUrl: post.key },
        ...(post.externalUrl ? { externalUrl: post.externalUrl } : {})
      });
  }

  for (const note of notes) {
    const fields = note.locales[locale];
    const month = parseYearMonth(note.updated);
    const updated = month ? `${t.months[month.month - 1]} ${month.year}` : note.updated;
    const related = note.related.map(id => byExperienceId.get(id)).filter((e): e is ExperienceRecord => !!e);
    b.add(`ctx.${note.id}`, `${fields.title}: ${fields.text} (${t.snapshot.updated} ${updated})`,
      {
        file: "assistant-context.txt",
        recordKey: note.id,
        pointers: [`/${note.id}/${locale}`],
        label: t.labels.note(fields.title, updated),
        target: { section: "notes", noteId: note.id }
      },
      {
        relatedSources: related.map(e => b.experienceSource(e, [])),
        ...(related.length === 1 ? { experienceId: related[0].id } : {})
      });
  }

  return { locale, entries: b.entries, byId: new Map(b.entries.map(e => [e.id, e])) };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Identifies the CV data a page or function was built with: the raw JSON (key order ignored)
 * and the evidence format. The browser sends it with each question; the function refuses to
 * answer for data it doesn't hold, instead of citing records the page may not have.
 */
export function knowledgeVersion(raw: RawKnowledge): string {
  const json = canonicalJson({ about: raw.about, experiences: raw.experiences, posts: raw.posts });
  return `v${EVIDENCE_FORMAT_VERSION}-${stableHash(json)}-${json.length.toString(16)}`;
}

/** The snapshot text in the prompt: one "[id] text" line per entry, in a fixed order. */
export function evidenceText(map: EvidenceMap): string {
  return map.entries.map(e => `[${e.id}] ${e.text}`).join("\n");
}

/**
 * The citations for a set of evidence IDs, in first-cited order, one per record (pointers
 * merged), followed by the related experiences of cited notes. Unknown IDs are ignored; the
 * caller validates IDs before rendering anything.
 */
export function sourcesFor(map: EvidenceMap, ids: readonly string[]): SourceRef[] {
  const sources: SourceRef[] = [];
  const add = (source: SourceRef) => {
    const index = sources.findIndex(s => s.file === source.file && s.recordKey === source.recordKey);
    if (index === -1) {
      sources.push(source);
      return;
    }
    const merged = sources[index];
    sources[index] = { ...merged, pointers: [...merged.pointers, ...source.pointers.filter(p => !merged.pointers.includes(p))] };
  };
  const entries = ids.map(id => map.byId.get(id)).filter((e): e is EvidenceEntry => !!e);
  entries.forEach(e => add(e.source));
  entries.forEach(e => e.relatedSources.forEach(add));
  return sources;
}
