/*
 * Turns a normalized question into exactly one interpretation (intent + resolved CV records) or a
 * fallback reason. A pattern only counts when every slot resolves to data in the snapshot through
 * an exact key or a reviewed alias; aliases point to existing records and never create facts.
 */
import { ExperienceRecord, FallbackReason, IntentId, KnowledgeSnapshot, MediaRecord, PostRecord } from "../models/assistant.models";
import { htmlToLine } from "../knowledge/plain-text";
import { entityKey, foldText, normalizeUtterance, technologyKey, tokenize } from "./normalize-question";
import { QUESTION_PATTERNS } from "./question-patterns";

export interface Interpretation {
  readonly intent: IntentId;
  readonly experience?: ExperienceRecord;
  /** Canonical technology key (see technologyKey) that exists in the CV's technology lists. */
  readonly technology?: string;
  readonly topicTokens?: readonly string[];
  readonly post?: PostRecord;
  readonly media?: MediaRecord;
}

export type Resolution =
  | { readonly kind: "resolved"; readonly interpretation: Interpretation }
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

interface SnapshotIndex {
  readonly companies: ReadonlyMap<string, readonly ExperienceRecord[]>;
  readonly technologies: ReadonlySet<string>;
  readonly networks: ReadonlyMap<string, readonly MediaRecord[]>;
  readonly titles: ReadonlyMap<string, readonly PostRecord[]>;
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
  const companies = new Map<string, ExperienceRecord[]>();
  const technologies = new Set<string>();
  snapshot.experiences.forEach(experience => {
    const name = experience.companyName.value;
    const key = entityKey(name);
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

  return { companies, technologies, networks, titles };
}

function indexFor(snapshot: KnowledgeSnapshot): SnapshotIndex {
  let index = INDEXES.get(snapshot);
  if (!index) {
    index = buildIndex(snapshot);
    INDEXES.set(snapshot, index);
  }
  return index;
}

type SlotResult<T> = { value: T } | { reason: FallbackReason };

function single<T>(matches: readonly T[] | undefined): SlotResult<T> {
  if (!matches || matches.length === 0) {
    return { reason: "unknown-entity" };
  }
  return matches.length === 1 ? { value: matches[0] } : { reason: "ambiguous" };
}

function resolveCompany(raw: string, index: SnapshotIndex): SlotResult<ExperienceRecord> {
  return single(index.companies.get(entityKey(raw.replace(SLOT_LEADING_WORDS, ""))));
}

function resolveTechnology(raw: string, index: SnapshotIndex): SlotResult<string> {
  const key = technologyKey(raw.replace(QUOTES, "").replace(SLOT_LEADING_WORDS, ""));
  const canonical = TECHNOLOGY_ALIASES[key] ?? key;
  return index.technologies.has(canonical) ? { value: canonical } : { reason: "unknown-entity" };
}

function resolveNetwork(raw: string, index: SnapshotIndex): SlotResult<MediaRecord> {
  const key = entityKey(raw.replace(SLOT_LEADING_WORDS, "").replace(NETWORK_TRAILING_WORDS, ""));
  return single(index.networks.get(NETWORK_ALIASES[key] ?? key));
}

function resolvePostTitle(raw: string, index: SnapshotIndex): SlotResult<PostRecord> {
  return single(index.titles.get(titleKey(htmlToLine(raw))));
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
    interpretation.media ? `${interpretation.media.title.pointer}` : ""
  ].join("|");
}

/** Strongest-first rejection reason when no pattern resolves. */
const REASON_RANK: readonly FallbackReason[] = ["ambiguous", "unknown-entity", "unrecognized"];

export function resolveQuestion(question: string, snapshot: KnowledgeSnapshot): Resolution {
  const utterance = normalizeUtterance(question);
  const index = indexFor(snapshot);
  const candidates = new Map<string, Interpretation>();
  let reason: FallbackReason = "unrecognized";
  const reject = (next: FallbackReason) => {
    if (REASON_RANK.indexOf(next) < REASON_RANK.indexOf(reason)) {
      reason = next;
    }
  };

  for (const pattern of QUESTION_PATTERNS) {
    const match = pattern.regex.exec(utterance);
    if (!match) {
      continue;
    }
    const slots = match.groups ?? {};
    let interpretation: Interpretation = { intent: pattern.intent };
    let rejected = false;
    const apply = <T>(raw: string | undefined, resolve: (value: string) => SlotResult<T>, assign: (value: T) => Interpretation) => {
      if (raw === undefined || rejected) {
        return;
      }
      const result = resolve(raw);
      if ("reason" in result) {
        rejected = true;
        reject(result.reason);
      } else {
        interpretation = assign(result.value);
      }
    };
    apply(slots["company"], raw => resolveCompany(raw, index), experience => ({ ...interpretation, experience }));
    apply(slots["technology"], raw => resolveTechnology(raw, index), technology => ({ ...interpretation, technology }));
    apply(slots["network"], raw => resolveNetwork(raw, index), media => ({ ...interpretation, media }));
    apply(slots["title"], raw => resolvePostTitle(raw, index), post => ({ ...interpretation, post }));
    apply(slots["topic"], resolveTopic, topicTokens => ({ ...interpretation, topicTokens }));
    if (!rejected) {
      candidates.set(interpretationKey(interpretation), interpretation);
    }
  }

  if (candidates.size === 1) {
    return { kind: "resolved", interpretation: [...candidates.values()][0] };
  }
  return { kind: "rejected", reason: candidates.size > 1 ? "ambiguous" : reason };
}
