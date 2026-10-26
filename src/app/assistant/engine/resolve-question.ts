/*
 * Turns a normalized question into exactly one interpretation (intent + resolved CV records), a
 * set of interpretations for the visitor to choose from, or a fallback reason. A pattern only
 * answers when every slot resolves to data in the snapshot through an exact key or a reviewed
 * alias; aliases point to existing records and never create facts. A name within a small edit
 * distance of a CV name, or one that names several records, never answers directly: it yields
 * options that the visitor confirms by asking the corrected question.
 */
import {
  ClarifyReason, ConversationContext, ExperienceRecord, FallbackReason, IntentId, KnowledgeSnapshot, LanguageRecord,
  MediaRecord, PostRecord, TopicRecord
} from "../models/assistant.models";
import { compareDates } from "../knowledge/knowledge-adapter";
import { htmlToLine } from "../knowledge/plain-text";
import { editDistance, entityKey, foldText, normalizeUtterance, technologyKey, toSecondPerson, tokenize, typoTolerance } from "./normalize-question";
import { CONTEXT_PATTERNS, ContextRelation, QUESTION_PATTERNS, SlotName } from "./question-patterns";

/** Intents about one experience record. */
export type ExperienceIntent =
  | "companyOverview" | "companyRole" | "companyDates" | "companyLocation" | "companyTechnologies" | "companyHighlights";

/** Intents that need no slot. */
export type GeneralIntent =
  | "profile" | "employers" | "currentRole" | "technologies" | "posts" | "hobbies" | "socialLinks"
  | "education" | "certifications" | "languages";

/**
 * A validated interpretation: each intent carries exactly the records its answer needs, so an
 * interpretation without them cannot be built (see toInterpretation).
 */
export type Interpretation =
  | { readonly intent: GeneralIntent }
  | { readonly intent: ExperienceIntent; readonly experience: ExperienceRecord }
  /** `technology` is a canonical technology key (see technologyKey) present in the CV's lists. */
  | { readonly intent: "technologyExperience"; readonly technology: string }
  | { readonly intent: "technologyAtCompany"; readonly technology: string; readonly experience: ExperienceRecord }
  | { readonly intent: "postSearch"; readonly topicTokens: readonly string[] }
  | { readonly intent: "postSummary"; readonly post: PostRecord }
  | { readonly intent: "socialLink"; readonly media: MediaRecord }
  /** `issuer` is the entityKey of a certification issuer exactly as the CV lists it. */
  | { readonly intent: "issuerCertifications"; readonly issuer: string }
  | { readonly intent: "languageProficiency"; readonly language: LanguageRecord }
  | { readonly intent: "topicSummary"; readonly topic: TopicRecord };

/** Records resolved for a pattern's slots, before they are checked against its intent. */
interface SlotValues {
  readonly experience?: ExperienceRecord;
  readonly technology?: string;
  readonly topicTokens?: readonly string[];
  readonly post?: PostRecord;
  readonly media?: MediaRecord;
  readonly issuer?: string;
  readonly language?: LanguageRecord;
  readonly topic?: TopicRecord;
}

/** One way to read a matched pattern: its intent and the records its slots resolved to. */
interface Reading {
  readonly intent: IntentId;
  readonly slots: SlotValues;
}

/** The interpretation a reading stands for, or null when it lacks a record its intent needs. */
function toInterpretation({ intent, slots }: Reading): Interpretation | null {
  const { experience, technology, topicTokens, post, media, issuer, language, topic } = slots;
  switch (intent) {
    case "profile":
    case "employers":
    case "currentRole":
    case "technologies":
    case "posts":
    case "hobbies":
    case "socialLinks":
    case "education":
    case "certifications":
    case "languages":
      return { intent };
    case "companyOverview":
    case "companyRole":
    case "companyDates":
    case "companyLocation":
    case "companyTechnologies":
    case "companyHighlights":
      return experience ? { intent, experience } : null;
    case "technologyExperience":
      return technology ? { intent, technology } : null;
    case "technologyAtCompany":
      return technology && experience ? { intent, technology, experience } : null;
    case "postSearch":
      return topicTokens ? { intent, topicTokens } : null;
    case "postSummary":
      return post ? { intent, post } : null;
    case "socialLink":
      return media ? { intent, media } : null;
    case "issuerCertifications":
      return issuer ? { intent, issuer } : null;
    case "languageProficiency":
      return language ? { intent, language } : null;
    case "topicSummary":
      return topic ? { intent, topic } : null;
  }
}

export type Resolution =
  | { readonly kind: "resolved"; readonly interpretation: Interpretation }
  | { readonly kind: "clarify"; readonly why: ClarifyReason; readonly options: readonly Interpretation[] }
  | { readonly kind: "rejected"; readonly reason: FallbackReason };

/* Reviewed recognition aliases. Each one maps to a name that must exist in the data to apply. */

/** entityKey(companyName) -> extra keys that name the same company. */
const COMPANY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  swisscomag: ["swisscom"],
  qatglobal: ["qat"],
  deevostudio: ["deevo"],
  faciltecnologias: ["facil"]
};
/** Trailing legal-form words that may be omitted ("Swisscom AG" -> "Swisscom"). */
const LEGAL_FORMS = new Set(["ag", "sa", "ltd", "ltda", "inc", "gmbh", "llc", "bv"]);

/** technologyKey(visitor wording) -> technologyKey of the CV value. Never Java<->JavaScript, Angular<->AngularJS. */
const TECHNOLOGY_ALIASES: Readonly<Record<string, string>> = {
  "js": "javascript",
  "ts": "typescript",
  "node": "node.js",
  "nodejs": "node.js",
  "node js": "node.js",
  "angular.js": "angularjs",
  "angular js": "angularjs",
  "reactjs": "react",
  "react.js": "react",
  "postgres": "postgresql",
  "mongo": "mongodb",
  "elasticsearch": "elastic search",
  "amazon web services": "aws",
  "cicd": "ci/cd",
  "ci cd": "ci/cd",
  "ci-cd": "ci/cd",
  "springboot": "spring boot",
  "spring-boot": "spring boot",
  "gitlab-ci": "gitlab ci",
  "unit testing": "unit tests",
  "integration testing": "integration tests",
  "html 5": "html5",
  "css 3": "css3",
  "word press": "wordpress",
  "k8s": "kubernetes"
};

/** entityKey(visitor wording) -> entityKey of a profile title or icon. */
const NETWORK_ALIASES: Readonly<Record<string, string>> = {
  fb: "facebook"
};

// Leading words a slot may carry that do not change which record is meant.
const SLOT_LEADING_WORDS = /^(?:the |a |an |o |os |as |company |empresa |a empresa |the company )+/;
const NETWORK_TRAILING_WORDS = / (?:profile|account|page|url|link|perfil|conta)$/;
const QUOTES = /^["'“”‘’«»]+|["'“”‘’«»]+$/g;

/** Technology entries "X (qualifier)" are documented variants of X, e.g. "Java (Android)" of "Java". */
export function technologyBaseKey(value: string): string | undefined {
  const match = /^(.+?)\s*\(([^()]+)\)$/.exec(value.trim());
  return match ? technologyKey(match[1]) : undefined;
}

export function technologyMatches(value: string, key: string): boolean {
  return technologyKey(value) === key || technologyBaseKey(value) === key;
}

export function titleKey(text: string): string {
  return foldText(text).replace(QUOTES, "").replace(/[.!?…]+$/, "").replace(/\s+/g, " ").trim();
}

/** Key for topic names and aliases: folded, hyphens read as spaces ("full-stack" = "full stack"). */
export function areaKey(text: string): string {
  return foldText(text).replace(QUOTES, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Keys an issuer is known by: its full name, and "Name (ABBR)" also as "Name" and "ABBR". */
function issuerKeys(issuer: string): string[] {
  const match = /^(.+?)\s*\(([^()]+)\)$/.exec(issuer.trim());
  return match ? [entityKey(issuer), entityKey(match[1]), entityKey(match[2])] : [entityKey(issuer)];
}

interface SnapshotIndex {
  /** Exact company names; they win over aliases, so a full name is never ambiguous with a short one. */
  readonly companyNames: ReadonlyMap<string, readonly ExperienceRecord[]>;
  /** Exact names plus aliases (legal form omitted, reviewed short names). */
  readonly companies: ReadonlyMap<string, readonly ExperienceRecord[]>;
  readonly technologies: ReadonlySet<string>;
  readonly networks: ReadonlyMap<string, readonly MediaRecord[]>;
  readonly titles: ReadonlyMap<string, readonly PostRecord[]>;
  /** Issuer keys -> entityKey of each full issuer name they name. */
  readonly issuers: ReadonlyMap<string, readonly string[]>;
  /** Language names in every site language. */
  readonly languages: ReadonlyMap<string, readonly LanguageRecord[]>;
  /** Topic IDs, localized names and aliases. */
  readonly topics: ReadonlyMap<string, readonly TopicRecord[]>;
}

const INDEXES = new WeakMap<KnowledgeSnapshot, SnapshotIndex>();

function addTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key) ?? [];
  if (!values.includes(value)) {
    values.push(value);
  }
  map.set(key, values);
}

function buildIndex(snapshot: KnowledgeSnapshot): SnapshotIndex {
  const companyNames = new Map<string, ExperienceRecord[]>();
  const companies = new Map<string, ExperienceRecord[]>();
  const technologies = new Set<string>();
  snapshot.experiences.forEach(experience => {
    const name = experience.companyName.value;
    const key = entityKey(name);
    addTo(companyNames, key, experience);
    addTo(companies, key, experience);
    const words = foldText(name).split(" ");
    if (words.length > 1 && LEGAL_FORMS.has(entityKey(words[words.length - 1]))) {
      addTo(companies, entityKey(words.slice(0, -1).join(" ")), experience);
    }
    (COMPANY_ALIASES[key] ?? []).forEach(alias => addTo(companies, alias, experience));
    experience.technologies.forEach(technology => {
      technologies.add(technologyKey(technology.value));
      const base = technologyBaseKey(technology.value);
      if (base) {
        technologies.add(base);
      }
    });
  });

  const networks = new Map<string, MediaRecord[]>();
  snapshot.about.medias.forEach(media => {
    addTo(networks, entityKey(media.title.value), media);
    addTo(networks, entityKey(media.icon.value), media);
  });

  const titles = new Map<string, PostRecord[]>();
  snapshot.posts.forEach(post => Object.values(post.locales)
    .forEach(fields => fields && addTo(titles, titleKey(fields.title.value), post)));

  const issuers = new Map<string, string[]>();
  snapshot.about.certifications.forEach(certification =>
    issuerKeys(certification.issuer.value).forEach(key => addTo(issuers, key, entityKey(certification.issuer.value))));

  const languages = new Map<string, LanguageRecord[]>();
  snapshot.about.languages.forEach(language => Object.values(language.locales)
    .forEach(fields => fields && addTo(languages, entityKey(fields.name.value), language)));

  const topics = new Map<string, TopicRecord[]>();
  snapshot.about.topics.forEach(topic => {
    addTo(topics, areaKey(topic.id.value), topic);
    topic.aliases.forEach(alias => addTo(topics, areaKey(alias.value), topic));
    Object.values(topic.locales).forEach(fields => fields && addTo(topics, areaKey(fields.name.value), topic));
  });

  return { companyNames, companies, technologies, networks, titles, issuers, languages, topics };
}

function indexFor(snapshot: KnowledgeSnapshot): SnapshotIndex {
  let index = INDEXES.get(snapshot);
  if (!index) {
    index = buildIndex(snapshot);
    INDEXES.set(snapshot, index);
  }
  return index;
}

/**
 * A slot resolves to one record, to several candidates the visitor must choose between (a near
 * miss or an ambiguous name), or not at all.
 */
type SlotResult<T> =
  | { value: T }
  | { alternatives: readonly T[]; why: ClarifyReason }
  | { reason: FallbackReason };

function single<T>(matches: readonly T[] | undefined, near: () => readonly T[]): SlotResult<T> {
  if (matches && matches.length === 1) {
    return { value: matches[0] };
  }
  if (matches && matches.length > 1) {
    return { alternatives: matches, why: "ambiguous" };
  }
  const nearMatches = near();
  return nearMatches.length > 0 ? { alternatives: nearMatches, why: "typo" } : { reason: "unknown-entity" };
}

/** Values of the keys closest to `key` within the typo tolerance (only the closest distance). */
function nearest<T>(key: string, keys: Iterable<string>, valuesOf: (key: string) => readonly T[]): T[] {
  const tolerance = typoTolerance(key.length);
  if (tolerance === 0) {
    return [];
  }
  let best = Infinity;
  let found: T[] = [];
  for (const candidate of keys) {
    if (typoTolerance(candidate.length) === 0) {
      continue;
    }
    const distance = editDistance(key, candidate, tolerance);
    if (distance < best) {
      best = distance;
      found = [];
    }
    if (distance === best && distance !== Infinity) {
      valuesOf(candidate).forEach(value => found.includes(value) || found.push(value));
    }
  }
  return found;
}

function resolveCompany(raw: string, index: SnapshotIndex): SlotResult<ExperienceRecord> {
  const key = entityKey(raw.replace(SLOT_LEADING_WORDS, ""));
  return single(index.companyNames.get(key) ?? index.companies.get(key), () => nearest(key, index.companies.keys(), k => index.companies.get(k)!));
}

function resolveTechnology(raw: string, index: SnapshotIndex): SlotResult<string> {
  const key = technologyKey(raw.replace(QUOTES, "").replace(SLOT_LEADING_WORDS, ""));
  const canonical = TECHNOLOGY_ALIASES[key] ?? key;
  if (index.technologies.has(canonical)) {
    return { value: canonical };
  }
  const near = nearest(key, index.technologies, k => [k]);
  return near.length > 0 ? { alternatives: near, why: "typo" } : { reason: "unknown-entity" };
}

function resolveNetwork(raw: string, index: SnapshotIndex): SlotResult<MediaRecord> {
  const stripped = entityKey(raw.replace(SLOT_LEADING_WORDS, "").replace(NETWORK_TRAILING_WORDS, ""));
  const key = NETWORK_ALIASES[stripped] ?? stripped;
  return single(index.networks.get(key), () => nearest(key, index.networks.keys(), k => index.networks.get(k)!));
}

function resolvePostTitle(raw: string, index: SnapshotIndex): SlotResult<PostRecord> {
  const key = titleKey(htmlToLine(raw));
  return single(index.titles.get(key), () => nearest(key, index.titles.keys(), k => index.titles.get(k)!));
}

function resolveIssuer(raw: string, index: SnapshotIndex): SlotResult<string> {
  const key = entityKey(raw.replace(QUOTES, "").replace(SLOT_LEADING_WORDS, ""));
  return single(index.issuers.get(key), () => nearest(key, index.issuers.keys(), k => index.issuers.get(k)!));
}

function resolveLanguage(raw: string, index: SnapshotIndex): SlotResult<LanguageRecord> {
  const key = entityKey(raw.replace(SLOT_LEADING_WORDS, ""));
  return single(index.languages.get(key), () => nearest(key, index.languages.keys(), k => index.languages.get(k)!));
}

function resolveArea(raw: string, index: SnapshotIndex): SlotResult<TopicRecord> {
  const key = areaKey(raw.replace(SLOT_LEADING_WORDS, ""));
  return single(index.topics.get(key), () => nearest(key, index.topics.keys(), k => index.topics.get(k)!));
}

function resolveTopic(raw: string): SlotResult<string[]> {
  const tokens = tokenize(raw.replace(QUOTES, "").replace(SLOT_LEADING_WORDS, ""));
  return tokens.length > 0 && tokens.length <= 6 ? { value: tokens } : { reason: "unknown-entity" };
}

function readingKey({ intent, slots }: Reading): string {
  return [
    intent,
    slots.experience?.id ?? "",
    slots.technology ?? "",
    slots.topicTokens?.join(" ") ?? "",
    slots.post?.key ?? "",
    slots.media ? `${slots.media.title.pointer}` : "",
    slots.issuer ?? "",
    slots.language?.code.value ?? "",
    slots.topic?.id.value ?? ""
  ].join("|");
}

/** Resolves one captured slot to the slot values it stands for (or alternatives, or a reason). */
type SlotResolver = (raw: string, index: SnapshotIndex) => SlotResult<SlotValues>;

function slotValues<T>(result: SlotResult<T>, toValues: (value: T) => SlotValues): SlotResult<SlotValues> {
  if ("value" in result) {
    return { value: toValues(result.value) };
  }
  return "alternatives" in result ? { alternatives: result.alternatives.map(toValues), why: result.why } : result;
}

/** Slot resolvers, in the order a pattern's slots are resolved. */
const SLOT_RESOLVERS: readonly (readonly [SlotName, SlotResolver])[] = [
  ["company", (raw, index) => slotValues(resolveCompany(raw, index), experience => ({ experience }))],
  ["technology", (raw, index) => slotValues(resolveTechnology(raw, index), technology => ({ technology }))],
  ["network", (raw, index) => slotValues(resolveNetwork(raw, index), media => ({ media }))],
  ["title", (raw, index) => slotValues(resolvePostTitle(raw, index), post => ({ post }))],
  ["topic", raw => slotValues(resolveTopic(raw), topicTokens => ({ topicTokens }))],
  ["issuer", (raw, index) => slotValues(resolveIssuer(raw, index), issuer => ({ issuer }))],
  ["language", (raw, index) => slotValues(resolveLanguage(raw, index), language => ({ language }))],
  ["area", (raw, index) => slotValues(resolveArea(raw, index), topic => ({ topic }))]
];

/** What one matched pattern's slots resolved to. */
type PatternOutcome =
  /** Every slot named exactly one record: these readings answer. */
  | { readonly kind: "matched"; readonly readings: readonly Reading[] }
  /** A slot was a near miss or named several records: the visitor chooses among the readings. */
  | { readonly kind: "near"; readonly why: ClarifyReason; readonly readings: readonly Reading[] }
  /** A slot names nothing in the CV. */
  | { readonly kind: "rejected"; readonly reason: FallbackReason };

/** Resolves a matched pattern's captured slots; pure, so each pattern's outcome stands alone. */
function resolvePatternSlots(intent: IntentId, captured: Readonly<Record<string, string | undefined>>, index: SnapshotIndex): PatternOutcome {
  let readings: Reading[] = [{ intent, slots: {} }];
  let why: ClarifyReason | null = null;
  for (const [name, resolve] of SLOT_RESOLVERS) {
    const raw = captured[name];
    if (raw === undefined) {
      continue;
    }
    const result = resolve(raw, index);
    if ("reason" in result) {
      return { kind: "rejected", reason: result.reason };
    }
    const values = "value" in result ? [result.value] : result.alternatives;
    if ("alternatives" in result) {
      why = why === "ambiguous" || result.why === "ambiguous" ? "ambiguous" : "typo";
    }
    readings = readings.flatMap(reading => values.map(value => ({ intent, slots: { ...reading.slots, ...value } })));
  }
  return why ? { kind: "near", why, readings } : { kind: "matched", readings };
}

/** The interpretations of distinct readings; a reading missing a required record is dropped. */
function interpretationsOf(readings: ReadonlyMap<string, Reading>): Interpretation[] {
  return [...readings.values()].map(toInterpretation).filter((i): i is Interpretation => i !== null);
}

/** Strongest-first rejection reason when no pattern resolves. */
const REASON_RANK: readonly FallbackReason[] = ["missing-fact", "ambiguous", "unknown-entity", "unrecognized"];

/** The experience that started right before/after `experience` (start date, then ID). */
function neighbour(snapshot: KnowledgeSnapshot, experience: ExperienceRecord, relation: ContextRelation): ExperienceRecord | undefined {
  if (relation === "same") {
    return experience;
  }
  const ordered = [...snapshot.experiences].sort((a, b) => compareDates(a.start, b.start) || a.id - b.id);
  const position = ordered.indexOf(experience);
  return ordered[relation === "previous" ? position - 1 : position + 1];
}

/**
 * Interprets the question. `context` is the experience the previous answer was about; only the
 * explicit follow-up forms in CONTEXT_PATTERNS use it.
 */
export function resolveQuestion(question: string, snapshot: KnowledgeSnapshot, context: ConversationContext = {}): Resolution {
  const utterance = normalizeUtterance(question);
  const resolution = resolveUtterance(utterance, snapshot, context);
  if (resolution.kind !== "rejected") {
    return resolution;
  }
  // A third-person question ("What did he achieve at Swisscom?") gets a second try in the second
  // person; if that does not resolve either, the original rejection reason stands.
  const secondPerson = toSecondPerson(utterance);
  const retry = secondPerson === utterance ? resolution : resolveUtterance(secondPerson, snapshot, context);
  return retry.kind === "rejected" ? resolution : retry;
}

function resolveUtterance(utterance: string, snapshot: KnowledgeSnapshot, context: ConversationContext): Resolution {
  const index = indexFor(snapshot);
  const candidates = new Map<string, Reading>();
  const near = new Map<string, Reading>();
  let nearWhy: ClarifyReason = "typo";
  let reason: FallbackReason = "unrecognized";
  const reject = (next: FallbackReason) => {
    if (REASON_RANK.indexOf(next) < REASON_RANK.indexOf(reason)) {
      reason = next;
    }
  };

  for (const pattern of CONTEXT_PATTERNS) {
    if (!pattern.regex.test(utterance)) {
      continue;
    }
    const referent = snapshot.experiences.find(e => e.id === context.experienceId);
    const target = referent && neighbour(snapshot, referent, pattern.relation);
    if (target) {
      const reading: Reading = { intent: pattern.intent, slots: { experience: target } };
      candidates.set(readingKey(reading), reading);
    } else {
      // No referent in the conversation, or no earlier/later role.
      reject(referent ? "missing-fact" : "unrecognized");
    }
  }

  for (const pattern of QUESTION_PATTERNS) {
    const match = pattern.regex.exec(utterance);
    if (!match) {
      continue;
    }
    const outcome = resolvePatternSlots(pattern.intent, match.groups ?? {}, index);
    if (outcome.kind === "rejected") {
      reject(outcome.reason);
      continue;
    }
    if (outcome.kind === "near" && outcome.why === "ambiguous") {
      nearWhy = "ambiguous";
    }
    outcome.readings.forEach(reading => (outcome.kind === "matched" ? candidates : near).set(readingKey(reading), reading));
  }

  const exact = interpretationsOf(candidates);
  if (exact.length === 1) {
    return { kind: "resolved", interpretation: exact[0] };
  }
  if (exact.length > 1) {
    return { kind: "clarify", why: "ambiguous", options: exact };
  }
  const options = interpretationsOf(near);
  if (options.length > 0) {
    return { kind: "clarify", why: nearWhy, options };
  }
  return { kind: "rejected", reason };
}
