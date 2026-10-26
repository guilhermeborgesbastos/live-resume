/*
 * Builds the answer for a resolved interpretation from fixed templates and sourced values only.
 * Returns null when the fact the intent needs is absent for the active locale, which the engine
 * turns into the default fallback (absence never means "no").
 */
import {
  AnswerBlock, CertificationRecord, ExperienceRecord, KnowledgeSnapshot, LanguageRecord, Locale, MediaRecord, PostRecord,
  SourceRef, SourcedDate, SourcedPartialDate, SourcedText, TemplateLine, TopicRecord
} from "../models/assistant.models";
import { compareDates, comparePartialDates } from "../knowledge/knowledge-adapter";
import { ANSWER_TEMPLATES, AnswerTemplates, formatMonthYear, formatPartialDate } from "./answer-templates";
import { entityKey, technologyKey, tokenize } from "./normalize-question";
import { Interpretation, technologyMatches } from "./resolve-question";

export interface ComposedAnswer {
  readonly blocks: readonly AnswerBlock[];
  readonly sources: readonly SourceRef[];
}

/** Code-point comparison: stable across browsers and runtime collation settings. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Most recent start date first, ties by ID. */
export function byStartDescending(a: ExperienceRecord, b: ExperienceRecord): number {
  return compareDates(b.start, a.start) || a.id - b.id;
}

/** Newest first, ties by unique URL. */
export function byDateDescending(a: PostRecord, b: PostRecord): number {
  return compareDates(b.date, a.date) || compareKeys(a.key, b.key);
}

/** Newest issue date first, ties by name, then by position in the file. */
export function byIssuedDescending(a: CertificationRecord, b: CertificationRecord): number {
  return comparePartialDates(b.issued, a.issued) || compareKeys(a.name.value, b.name.value) || compareKeys(a.pointer, b.pointer);
}

const dateFact = (date: SourcedDate | SourcedPartialDate): SourcedText => ({ value: date.raw, pointer: date.pointer });
const line = (text: string, ...facts: SourcedText[]): TemplateLine => ({ text, facts });

class Composer {
  private readonly t: AnswerTemplates;
  private readonly sources: SourceRef[] = [];

  constructor(private readonly snapshot: KnowledgeSnapshot, private readonly locale: Locale) {
    this.t = ANSWER_TEMPLATES[locale];
  }

  done(blocks: AnswerBlock[]): ComposedAnswer {
    return { blocks, sources: this.sources };
  }

  // --- provenance -----------------------------------------------------------------------------

  private cite(source: SourceRef): void {
    const existing = this.sources.findIndex(s => s.file === source.file && s.recordKey === source.recordKey);
    if (existing === -1) {
      this.sources.push(source);
      return;
    }
    const merged = this.sources[existing];
    this.sources[existing] = {
      ...merged,
      pointers: [...merged.pointers, ...source.pointers.filter(p => !merged.pointers.includes(p))],
      ...(merged.externalUrl || !source.externalUrl ? {} : { externalUrl: source.externalUrl })
    };
  }

  citeAbout(pointers: string[], externalUrl?: string): void {
    this.cite({
      file: "about.json",
      recordKey: "about",
      pointers,
      label: this.t.labels.about,
      target: { section: "about" },
      ...(externalUrl ? { externalUrl } : {})
    });
  }

  /** Each certification is its own source, linking to its credential page when the CV gives one. */
  citeCertification(certification: CertificationRecord, pointers: string[]): void {
    this.cite({
      file: "about.json",
      recordKey: certification.pointer,
      pointers,
      label: certification.name.value,
      target: { section: "about" },
      ...(certification.url ? { externalUrl: certification.url.value } : {})
    });
  }

  citeExperience(experience: ExperienceRecord, pointers: string[]): void {
    this.cite({
      file: "experiences.json",
      recordKey: String(experience.id),
      pointers: [experience.companyName.pointer, ...pointers],
      label: this.t.labels.experience(experience.companyName.value),
      target: { section: "experience", experienceId: experience.id }
    });
  }

  citePost(post: PostRecord, pointers: string[]): boolean {
    const fields = post.locales[this.locale];
    if (!fields) {
      return false;
    }
    this.cite({
      file: "posts.json",
      recordKey: post.key,
      pointers: [post.keyPointer, ...pointers],
      label: fields.title.value,
      target: { section: "posts", postUrl: post.key },
      ...(post.externalUrl ? { externalUrl: post.externalUrl } : {})
    });
    return true;
  }

  // --- formatting -----------------------------------------------------------------------------

  month(date: SourcedDate): string {
    return formatMonthYear(date, this.locale);
  }

  range(experience: ExperienceRecord): string {
    return experience.end
      ? this.t.closedRange(this.month(experience.start), this.month(experience.end))
      : this.t.ongoingRange(this.month(experience.start));
  }

  rangeFacts(experience: ExperienceRecord): SourcedText[] {
    return experience.end ? [dateFact(experience.start), dateFact(experience.end)] : [dateFact(experience.start)];
  }

  // --- intents --------------------------------------------------------------------------------

  profile(): ComposedAnswer | null {
    const description = this.snapshot.about.descriptions[this.locale];
    if (!description) {
      return null;
    }
    this.citeAbout([description.pointer]);
    return this.done([{ kind: "excerpt", label: this.t.excerpts.about, excerpt: description }]);
  }

  employers(): ComposedAnswer | null {
    const experiences = [...this.snapshot.experiences].sort(byStartDescending);
    if (experiences.length === 0) {
      return null;
    }
    const items = experiences.map(experience => {
      this.citeExperience(experience, this.rangeFacts(experience).map(f => f.pointer));
      return line(this.t.employerItem(experience.companyName.value, this.range(experience)),
        experience.companyName, ...this.rangeFacts(experience));
    });
    return this.done([{ kind: "list", intro: line(this.t.employersIntro), items }]);
  }

  currentRole(): ComposedAnswer | null {
    const ongoing = this.snapshot.experiences.filter(e => !e.end).sort(byStartDescending);
    const roles = ongoing.map(experience => ({ experience, fields: experience.locales[this.locale] }));
    if (roles.length === 0 || roles.some(r => !r.fields)) {
      return null;
    }
    const lines = roles.map(({ experience, fields }) => {
      this.citeExperience(experience, [fields!.role.pointer, experience.start.pointer]);
      const args = [fields!.role.value, experience.companyName.value, this.month(experience.start)] as const;
      return { args, facts: [fields!.role, experience.companyName, dateFact(experience.start)] };
    });
    if (lines.length === 1) {
      return this.done([{ kind: "text", line: line(this.t.currentRole(...lines[0].args), ...lines[0].facts) }]);
    }
    return this.done([{
      kind: "list",
      intro: line(this.t.currentRolesIntro),
      items: lines.map(l => line(this.t.currentRoleItem(...l.args), ...l.facts))
    }]);
  }

  companyOverview(experience: ExperienceRecord): ComposedAnswer | null {
    const fields = experience.locales[this.locale];
    if (!fields) {
      return null;
    }
    const blocks: AnswerBlock[] = [
      { kind: "text", line: line(this.t.overviewHeadline(fields.role.value, experience.companyName.value), fields.role, experience.companyName) },
      { kind: "text", line: line(this.t.overviewPeriod(this.range(experience)), ...this.rangeFacts(experience)) }
    ];
    const pointers = [fields.role.pointer, ...this.rangeFacts(experience).map(f => f.pointer)];
    const place = this.place(fields.city, fields.country);
    if (place) {
      blocks.push({ kind: "text", line: line(this.t.overviewLocation(place.text), ...place.facts) });
      pointers.push(...place.facts.map(f => f.pointer));
    }
    blocks.push({ kind: "excerpt", label: this.t.excerpts.experience, excerpt: fields.description });
    pointers.push(fields.description.pointer);
    this.citeExperience(experience, pointers);
    return this.done(blocks);
  }

  companyRole(experience: ExperienceRecord): ComposedAnswer | null {
    const fields = experience.locales[this.locale];
    if (!fields) {
      return null;
    }
    this.citeExperience(experience, [fields.role.pointer]);
    return this.done([{ kind: "text", line: line(this.t.companyRole(experience.companyName.value, fields.role.value), experience.companyName, fields.role) }]);
  }

  companyDates(experience: ExperienceRecord): ComposedAnswer {
    const company = experience.companyName.value;
    const text = experience.end
      ? this.t.companyDatesClosed(company, this.month(experience.start), this.month(experience.end))
      : this.t.companyDatesOngoing(company, this.month(experience.start));
    this.citeExperience(experience, this.rangeFacts(experience).map(f => f.pointer));
    return this.done([{ kind: "text", line: line(text, experience.companyName, ...this.rangeFacts(experience)) }]);
  }

  companyLocation(experience: ExperienceRecord): ComposedAnswer | null {
    const fields = experience.locales[this.locale];
    const place = fields && this.place(fields.city, fields.country);
    if (!place) {
      return null;
    }
    this.citeExperience(experience, place.facts.map(f => f.pointer));
    return this.done([{ kind: "text", line: line(this.t.companyLocation(experience.companyName.value, place.text), experience.companyName, ...place.facts) }]);
  }

  technologies(): ComposedAnswer | null {
    const byKey = new Map<string, SourcedText>();
    [...this.snapshot.experiences].sort(byStartDescending).forEach(experience => {
      if (experience.technologies.length > 0) {
        this.citeExperience(experience, experience.technologies.map(t => t.pointer));
      }
      experience.technologies.forEach(technology => {
        const key = technologyKey(technology.value);
        if (!byKey.has(key)) {
          byKey.set(key, technology);
        }
      });
    });
    if (byKey.size === 0) {
      return null;
    }
    const values = [...byKey.entries()].sort(([a], [b]) => compareKeys(a, b)).map(([, value]) => value);
    return this.done([{ kind: "values", intro: line(this.t.technologiesIntro), values }]);
  }

  technologyExperience(key: string): ComposedAnswer | null {
    const matches = [...this.snapshot.experiences].sort(byStartDescending)
      .map(experience => ({ experience, values: experience.technologies.filter(t => technologyMatches(t.value, key)) }))
      .filter(match => match.values.length > 0);
    if (matches.length === 0 || matches.some(m => !m.experience.locales[this.locale])) {
      return null;
    }
    const all = matches.flatMap(m => m.values);
    const display = (all.find(value => technologyKey(value.value) === key) ?? all[0]).value;
    const items = matches.map(({ experience, values }) => {
      const role = experience.locales[this.locale]!.role;
      this.citeExperience(experience, [role.pointer, ...this.rangeFacts(experience).map(f => f.pointer), ...values.map(v => v.pointer)]);
      const listedAs = values.some(v => v.value === display) ? null : values.map(v => v.value).join(", ");
      return line(this.t.technologyExperienceItem(experience.companyName.value, role.value, this.range(experience), listedAs),
        experience.companyName, role, ...this.rangeFacts(experience), ...values);
    });
    const displayFact = all.find(value => value.value === display)!;
    return this.done([{ kind: "list", intro: line(this.t.technologyExperienceIntro(display), displayFact), items }]);
  }

  companyTechnologies(experience: ExperienceRecord): ComposedAnswer | null {
    if (experience.technologies.length === 0) {
      return null;
    }
    this.citeExperience(experience, experience.technologies.map(t => t.pointer));
    return this.done([{
      kind: "values",
      intro: line(this.t.companyTechnologiesIntro(experience.companyName.value), experience.companyName),
      values: experience.technologies
    }]);
  }

  technologyAtCompany(key: string, experience: ExperienceRecord): ComposedAnswer | null {
    const values = experience.technologies.filter(t => technologyMatches(t.value, key));
    if (values.length === 0) {
      return null;
    }
    this.citeExperience(experience, values.map(v => v.pointer));
    const text = this.t.technologyAtCompany(values.map(v => v.value).join(", "), experience.companyName.value);
    return this.done([{ kind: "text", line: line(text, ...values, experience.companyName) }]);
  }

  private postLines(posts: readonly PostRecord[]): TemplateLine[] | null {
    const sorted = [...posts].sort(byDateDescending);
    if (sorted.length === 0 || sorted.some(post => !post.locales[this.locale])) {
      return null;
    }
    return sorted.map(post => {
      const title = post.locales[this.locale]!.title;
      this.citePost(post, [title.pointer, post.date.pointer]);
      return line(this.t.postItem(title.value, this.month(post.date)), title, dateFact(post.date));
    });
  }

  posts(): ComposedAnswer | null {
    const items = this.postLines(this.snapshot.posts);
    return items && this.done([{ kind: "list", intro: line(this.t.postsIntro), items }]);
  }

  postSearch(tokens: readonly string[]): ComposedAnswer | null {
    const matches = this.snapshot.posts.filter(post => {
      const fields = post.locales[this.locale];
      if (!fields) {
        return false;
      }
      const words = new Set([...tokenize(fields.title.value), ...fields.description.paragraphs.flatMap(p => tokenize(p))]);
      return tokens.every(token => words.has(token));
    });
    const items = this.postLines(matches);
    if (!items) {
      return null;
    }
    // The search matched the summary text too, so cite it as evidence.
    matches.forEach(post => this.citePost(post, [post.locales[this.locale]!.description.pointer]));
    return this.done([{ kind: "list", intro: line(this.t.postSearchIntro), items }]);
  }

  postSummary(post: PostRecord): ComposedAnswer | null {
    const fields = post.locales[this.locale];
    if (!fields) {
      return null;
    }
    this.citePost(post, [fields.title.pointer, post.date.pointer, fields.description.pointer]);
    return this.done([
      { kind: "text", line: line(this.t.postItem(fields.title.value, this.month(post.date)), fields.title, dateFact(post.date)) },
      { kind: "excerpt", label: this.t.excerpts.post, excerpt: fields.description }
    ]);
  }

  hobbies(): ComposedAnswer | null {
    const hobbies = this.snapshot.about.hobbies;
    const translations = this.t.hobbyTitles;
    if (hobbies.length === 0 || (translations && hobbies.some(h => !(h.value in translations)))) {
      return null;
    }
    this.citeAbout(hobbies.map(h => h.pointer));
    // Translated labels keep the pointer of the hobby title they translate.
    const values = hobbies.map(h => translations ? { value: translations[h.value], pointer: h.pointer } : h);
    return this.done([{ kind: "values", intro: line(this.t.hobbiesIntro), values }]);
  }

  socialLink(media: MediaRecord): ComposedAnswer | null {
    if (!media.url) {
      return null;
    }
    this.citeAbout([media.title.pointer, media.url.pointer], media.url.value);
    return this.done([{ kind: "text", line: line(this.t.socialLink(media.title.value, media.url.value), media.title, media.url) }]);
  }

  socialLinks(): ComposedAnswer | null {
    const medias = this.snapshot.about.medias.filter(m => m.url);
    if (medias.length === 0) {
      return null;
    }
    this.citeAbout(medias.flatMap(m => [m.title.pointer, m.url!.pointer]));
    return this.done([{
      kind: "list",
      intro: line(this.t.socialLinksIntro),
      items: medias.map(m => line(this.t.socialLinkItem(m.title.value, m.url!.value), m.title, m.url!))
    }]);
  }

  education(): ComposedAnswer | null {
    const records = this.snapshot.about.education;
    if (records.length === 0 || records.some(r => !r.locales[this.locale])) {
      return null;
    }
    const items = records.map(record => {
      const fields = record.locales[this.locale]!;
      const dates = [record.start, record.end].filter((d): d is SourcedPartialDate => d !== undefined);
      const period = dates.length === 0 ? null : dates.map(d => formatPartialDate(d, this.locale)).join(" – ");
      const facts = [fields.degree, ...(fields.field ? [fields.field] : []), record.school, ...dates.map(dateFact)];
      this.citeAbout(facts.map(f => f.pointer));
      return line(this.t.educationItem(fields.degree.value, fields.field?.value ?? null, record.school.value, period), ...facts);
    });
    return this.done([{ kind: "list", intro: line(this.t.educationIntro), items }]);
  }

  certifications(issuer?: string): ComposedAnswer | null {
    const records = this.snapshot.about.certifications
      .filter(c => issuer === undefined || entityKey(c.issuer.value) === issuer)
      .sort(byIssuedDescending);
    if (records.length === 0) {
      return null;
    }
    const items = records.map(record => {
      const dates = [record.issued, ...(record.expires ? [record.expires] : [])];
      const facts = [record.name, record.type, record.issuer, ...dates.map(dateFact)];
      this.citeCertification(record, [...facts.map(f => f.pointer), ...(record.url ? [record.url.pointer] : [])]);
      const text = this.t.certificationItem(record.name.value, this.t.certificationTypes[record.type.value], record.issuer.value,
        formatPartialDate(record.issued, this.locale), record.expires ? formatPartialDate(record.expires, this.locale) : null);
      return line(text, ...facts);
    });
    const intro = issuer === undefined
      ? line(this.t.certificationsIntro)
      : line(this.t.issuerCertificationsIntro(records[0].issuer.value), records[0].issuer);
    return this.done([{ kind: "list", intro, items }]);
  }

  languages(): ComposedAnswer | null {
    const records = this.snapshot.about.languages;
    if (records.length === 0 || records.some(r => !r.locales[this.locale])) {
      return null;
    }
    const items = records.map(record => {
      const { name, proficiency } = record.locales[this.locale]!;
      this.citeAbout([name.pointer, proficiency.pointer]);
      return line(this.t.languageItem(name.value, proficiency.value), name, proficiency);
    });
    return this.done([{ kind: "list", intro: line(this.t.languagesIntro), items }]);
  }

  languageProficiency(language: LanguageRecord): ComposedAnswer | null {
    const fields = language.locales[this.locale];
    if (!fields) {
      return null;
    }
    this.citeAbout([fields.name.pointer, fields.proficiency.pointer]);
    return this.done([{
      kind: "text",
      line: line(this.t.languageProficiency(fields.name.value, fields.proficiency.value), fields.name, fields.proficiency)
    }]);
  }

  topicSummary(topic: TopicRecord): ComposedAnswer | null {
    const fields = topic.locales[this.locale];
    const experiences = topic.experienceIds
      .map(id => this.snapshot.experiences.find(e => e.id === id))
      .filter((e): e is ExperienceRecord => e !== undefined)
      .sort(byStartDescending);
    if (!fields || experiences.length === 0 || experiences.some(e => !e.locales[this.locale])) {
      return null;
    }
    this.citeAbout([fields.name.pointer, fields.summary.pointer]);
    const items = experiences.map(experience => {
      const role = experience.locales[this.locale]!.role;
      this.citeExperience(experience, [role.pointer, ...this.rangeFacts(experience).map(f => f.pointer)]);
      return line(this.t.topicRoleItem(experience.companyName.value, role.value, this.range(experience)),
        experience.companyName, role, ...this.rangeFacts(experience));
    });
    return this.done([
      { kind: "excerpt", label: this.t.excerpts.topic(fields.name.value), excerpt: fields.summary },
      { kind: "list", intro: line(this.t.topicRolesIntro), items }
    ]);
  }

  companyHighlights(experience: ExperienceRecord): ComposedAnswer | null {
    const highlights = experience.locales[this.locale]?.highlights ?? [];
    if (highlights.length === 0) {
      return null;
    }
    this.citeExperience(experience, highlights.map(h => h.pointer));
    return this.done([{
      kind: "list",
      intro: line(this.t.companyHighlightsIntro(experience.companyName.value), experience.companyName),
      items: highlights.map(h => line(h.value, h))
    }]);
  }

  private place(city?: SourcedText, country?: SourcedText): { text: string; facts: SourcedText[] } | null {
    if (!city) {
      return null;
    }
    return country
      ? { text: `${city.value}, ${country.value}`, facts: [city, country] }
      : { text: city.value, facts: [city] };
  }
}

export function composeAnswer(interpretation: Interpretation, snapshot: KnowledgeSnapshot, locale: Locale): ComposedAnswer | null {
  const c = new Composer(snapshot, locale);
  const { experience, technology, topicTokens, post, media, issuer, language, topic } = interpretation;
  switch (interpretation.intent) {
    case "profile": return c.profile();
    case "employers": return c.employers();
    case "currentRole": return c.currentRole();
    case "companyOverview": return c.companyOverview(experience!);
    case "companyRole": return c.companyRole(experience!);
    case "companyDates": return c.companyDates(experience!);
    case "companyLocation": return c.companyLocation(experience!);
    case "technologies": return c.technologies();
    case "technologyExperience": return c.technologyExperience(technology!);
    case "companyTechnologies": return c.companyTechnologies(experience!);
    case "technologyAtCompany": return c.technologyAtCompany(technology!, experience!);
    case "posts": return c.posts();
    case "postSearch": return c.postSearch(topicTokens!);
    case "postSummary": return c.postSummary(post!);
    case "hobbies": return c.hobbies();
    case "socialLink": return c.socialLink(media!);
    case "socialLinks": return c.socialLinks();
    case "education": return c.education();
    case "certifications": return c.certifications();
    case "issuerCertifications": return c.certifications(issuer!);
    case "languages": return c.languages();
    case "languageProficiency": return c.languageProficiency(language!);
    case "topicSummary": return c.topicSummary(topic!);
    case "companyHighlights": return c.companyHighlights(experience!);
  }
}
