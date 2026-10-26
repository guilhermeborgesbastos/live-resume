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
import { editDistance, entityKey, foldText, normalizeUtterance, technologyKey, tokenize, typoTolerance } from "./normalize-question";
import { CONTEXT_PATTERNS, ContextRelation, QUESTION_PATTERNS } from "./question-patterns";

export interface Interpretation {
  readonly intent: IntentId;
  readonly experience?: ExperienceRecord;
  /** Canonical technology key (see technologyKey) that exists in the CV's technology lists. */
  readonly technology?: string;
  readonly topicTokens?: readonly string[];
  readonly post?: PostRecord;
  readonly media?: MediaRecord;
  /** entityKey of a certification issuer exactly as the CV lists it. */
  readonly issuer?: string;
  readonly language?: LanguageRecord;
  readonly topic?: TopicRecord;
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

function interpretationKey(interpretation: Interpretation): string {
  return [
    interpretation.intent,
    interpretation.experience?.id ?? "",
    interpretation.technology ?? "",
    interpretation.topicTokens?.join(" ") ?? "",
    interpretation.post?.key ?? "",
    interpretation.media ? `${interpretation.media.title.pointer}` : "",
    interpretation.issuer ?? "",
    interpretation.language?.code.value ?? "",
    interpretation.topic?.id.value ?? ""
  ].join("|");
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
  const index = indexFor(snapshot);
  const candidates = new Map<string, Interpretation>();
  const near = new Map<string, Interpretation>();
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
      const interpretation: Interpretation = { intent: pattern.intent, experience: target };
      candidates.set(interpretationKey(interpretation), interpretation);
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
    const slots = match.groups ?? {};
    // Every reading of this pattern: one, or several when a slot needs the visitor to choose.
    let readings: Interpretation[] = [{ intent: pattern.intent }];
    let approximate = false;
    let rejected = false;
    const apply = <T>(raw: string | undefined, resolve: (value: string) => SlotResult<T>, assign: (reading: Interpretation, value: T) => Interpretation) => {
      if (raw === undefined || rejected) {
        return;
      }
      const result = resolve(raw);
      if ("reason" in result) {
        rejected = true;
        reject(result.reason);
      } else if ("value" in result) {
        readings = readings.map(reading => assign(reading, result.value));
      } else {
        approximate = true;
        if (result.why === "ambiguous") {
          nearWhy = "ambiguous";
        }
        readings = readings.flatMap(reading => result.alternatives.map(value => assign(reading, value)));
      }
    };
    apply(slots["company"], raw => resolveCompany(raw, index), (r, experience) => ({ ...r, experience }));
    apply(slots["technology"], raw => resolveTechnology(raw, index), (r, technology) => ({ ...r, technology }));
    apply(slots["network"], raw => resolveNetwork(raw, index), (r, media) => ({ ...r, media }));
    apply(slots["title"], raw => resolvePostTitle(raw, index), (r, post) => ({ ...r, post }));
    apply(slots["topic"], resolveTopic, (r, topicTokens) => ({ ...r, topicTokens }));
    apply(slots["issuer"], raw => resolveIssuer(raw, index), (r, issuer) => ({ ...r, issuer }));
    apply(slots["language"], raw => resolveLanguage(raw, index), (r, language) => ({ ...r, language }));
    apply(slots["area"], raw => resolveArea(raw, index), (r, topic) => ({ ...r, topic }));
    if (!rejected) {
      readings.forEach(reading => (approximate ? near : candidates).set(interpretationKey(reading), reading));
    }
  }

  if (candidates.size === 1) {
    return { kind: "resolved", interpretation: [...candidates.values()][0] };
  }
  if (candidates.size > 1) {
    return { kind: "clarify", why: "ambiguous", options: [...candidates.values()] };
  }
  if (near.size > 0) {
    return { kind: "clarify", why: nearWhy, options: [...near.values()] };
  }
  return { kind: "rejected", reason };
}
