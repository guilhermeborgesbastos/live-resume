/*
 * The CV assistant's deterministic answer engine. Pure: no Angular, HTTP, storage, clock or
 * randomness. The same question, locale, snapshot and context always give the same answer,
 * sources and order. The only conversation input is the explicit `context` (the experience the
 * previous answer was about), used by follow-ups such as "And before that?".
 */
import {
  AnswerBlock, AnswerResult, ConversationContext, ExperienceRecord, IntentId, KnowledgeSnapshot, Locale
} from "../models/assistant.models";
import { ANSWER_TEMPLATES } from "./answer-templates";
import { byStartDescending, compareKeys, composeAnswer } from "./compose-answer";
import { normalizeUtterance, technologyKey, tokenize, validateQuestion } from "./normalize-question";
import { Interpretation, resolveQuestion, technologyBaseKey } from "./resolve-question";

export { validateQuestion, MAX_QUESTION_LENGTH } from "./normalize-question";

export interface SuggestedQuestion {
  readonly intent: IntentId;
  readonly question: string;
}

/** At most this many "did you mean" options are offered. */
const MAX_CLARIFY_OPTIONS = 3;

export function answerQuestion(question: string, locale: Locale, snapshot: KnowledgeSnapshot | null, context: ConversationContext = {}): AnswerResult {
  return answer(question, locale, snapshot, true, context);
}

/**
 * `topLevel` is false when the engine checks one of its own suggestions, follow-ups or options:
 * those only need to know whether the question answers, so no follow-ups or options are computed
 * (which also keeps an ambiguous option from recursing).
 */
function answer(question: string, locale: Locale, snapshot: KnowledgeSnapshot | null, topLevel: boolean, context: ConversationContext = {}): AnswerResult {
  if (!snapshot) {
    return { kind: "unavailable" };
  }
  const validation = validateQuestion(question);
  if ("error" in validation) {
    return { kind: "fallback", reason: "unrecognized" };
  }
  const resolution = resolveQuestion(validation.question, snapshot, context);
  if (resolution.kind === "rejected") {
    return { kind: "fallback", reason: resolution.reason };
  }
  if (resolution.kind === "clarify" && !topLevel) {
    return { kind: "fallback", reason: resolution.why === "typo" ? "unknown-entity" : "ambiguous" };
  }
  if (resolution.kind === "clarify") {
    // Offer each reading as a supported question that the visitor confirms by asking it.
    const options = answerable(resolution.options.map(option => canonicalQuestion(option, snapshot, locale)), locale, snapshot)
      .slice(0, MAX_CLARIFY_OPTIONS);
    return options.length > 0
      ? { kind: "clarify", reason: resolution.why, options }
      : { kind: "fallback", reason: resolution.why === "typo" ? "unknown-entity" : "ambiguous" };
  }
  const { interpretation } = resolution;
  const composed = composeAnswer(interpretation, snapshot, locale);
  if (!composed) {
    return { kind: "fallback", reason: interpretation.intent === "postSearch" ? "no-results" : "missing-fact" };
  }
  const followUps = topLevel
    ? answerable(followUpCandidates(interpretation, snapshot, locale), locale, snapshot)
      .filter(q => normalizeUtterance(q) !== normalizeUtterance(validation.question))
    : [];
  const subject = subjectOf(interpretation, snapshot);
  return {
    kind: "answered",
    intent: interpretation.intent,
    blocks: composed.blocks,
    sources: composed.sources,
    followUps,
    ...(subject ? { subject } : {})
  };
}

function answerable(questions: (string | null)[], locale: Locale, snapshot: KnowledgeSnapshot): string[] {
  return questions.filter((q, i): q is string => q !== null && questions.indexOf(q) === i
    && answer(q, locale, snapshot, false).kind === "answered");
}

/** The single experience an answer was about: the referent for the next follow-up. */
function subjectOf(interpretation: Interpretation, snapshot: KnowledgeSnapshot): ConversationContext | null {
  if (interpretation.experience) {
    return { experienceId: interpretation.experience.id };
  }
  if (interpretation.intent === "currentRole") {
    const ongoing = snapshot.experiences.filter(e => !e.end);
    return ongoing.length === 1 ? { experienceId: ongoing[0].id } : null;
  }
  return null;
}

/** The CV's own spelling of a technology key ("javascript" -> "Javascript"). */
function technologyDisplay(key: string, snapshot: KnowledgeSnapshot): string | null {
  const values = snapshot.experiences.flatMap(e => e.technologies.map(t => t.value));
  const exact = values.find(value => technologyKey(value) === key);
  const variant = values.find(value => technologyBaseKey(value) === key);
  return exact ?? variant?.replace(/\s*\([^()]+\)$/, "") ?? null;
}

/** A supported question that asks exactly this interpretation, in the site's language. */
function canonicalQuestion(interpretation: Interpretation, snapshot: KnowledgeSnapshot, locale: Locale): string | null {
  const q = ANSWER_TEMPLATES[locale].questions;
  const company = interpretation.experience?.companyName.value ?? "";
  const technology = interpretation.technology ? technologyDisplay(interpretation.technology, snapshot) : null;
  switch (interpretation.intent) {
    case "profile": return q.profile;
    case "employers": return q.employers;
    case "currentRole": return q.currentRole;
    case "technologies": return q.technologies;
    case "posts": return q.posts;
    case "hobbies": return q.hobbies;
    case "socialLinks": return q.socialLinks;
    case "companyOverview": return q.companyOverview(company);
    case "companyRole": return q.companyRole(company);
    case "companyDates": return q.companyDates(company);
    case "companyLocation": return q.companyLocation(company);
    case "companyTechnologies": return q.companyTechnologies(company);
    case "technologyExperience": return technology && q.technologyExperience(technology);
    case "technologyAtCompany": return technology && q.technologyAtCompany(technology, company);
    case "postSearch": return q.postSearch(interpretation.topicTokens!.join(" "));
    case "postSummary": {
      const fields = interpretation.post!.locales[locale];
      return fields ? q.postSummary(fields.title.value) : null;
    }
    case "socialLink": return q.socialLink(interpretation.media!.title.value);
  }
}

function latestExperience(snapshot: KnowledgeSnapshot): ExperienceRecord | undefined {
  return [...snapshot.experiences].sort(byStartDescending)[0];
}

function followUpCandidates(interpretation: Interpretation, snapshot: KnowledgeSnapshot, locale: Locale): string[] {
  const q = ANSWER_TEMPLATES[locale].questions;
  const company = interpretation.experience?.companyName.value;
  switch (interpretation.intent) {
    case "profile":
      return [q.employers, q.currentRole];
    case "employers": {
      const latest = latestExperience(snapshot);
      return latest ? [q.companyOverview(latest.companyName.value)] : [];
    }
    case "currentRole": {
      const ongoing = snapshot.experiences.filter(e => !e.end).sort(byStartDescending)[0];
      return ongoing ? [q.companyOverview(ongoing.companyName.value), q.companyTechnologies(ongoing.companyName.value)] : [];
    }
    case "companyOverview":
      return [q.companyTechnologies(company!), q.companyDates(company!)];
    case "companyRole":
    case "companyDates":
    case "companyLocation":
    case "companyTechnologies":
      return [q.companyOverview(company!)];
    case "technologyAtCompany":
      return [q.companyTechnologies(company!)];
    case "technologyExperience": {
      const first = [...snapshot.experiences].sort(byStartDescending)
        .find(e => e.technologies.some(t => technologyKey(t.value) === interpretation.technology));
      return first ? [q.companyTechnologies(first.companyName.value)] : [];
    }
    case "technologies": {
      const technology = mostListedTechnology(snapshot);
      return technology ? [q.technologyExperience(technology)] : [];
    }
    default:
      return [];
  }
}

/** The technology value listed in the most experience records (ties: smallest key). */
function mostListedTechnology(snapshot: KnowledgeSnapshot): string | undefined {
  const counts = new Map<string, { value: string; count: number }>();
  [...snapshot.experiences].sort(byStartDescending).forEach(experience => {
    new Set(experience.technologies.map(t => technologyKey(t.value))).forEach(key => {
      const display = experience.technologies.find(t => technologyKey(t.value) === key)!.value;
      const entry = counts.get(key) ?? { value: display, count: 0 };
      counts.set(key, { ...entry, count: entry.count + 1 });
    });
  });
  return [...counts.entries()]
    .sort(([keyA, a], [keyB, b]) => (b.count - a.count) || compareKeys(keyA, keyB))[0]?.[1].value;
}

/** A CV technology that also appears as a word in the most post titles/summaries (ties: smallest key). */
function mostWrittenAboutTechnology(snapshot: KnowledgeSnapshot, locale: Locale): string | undefined {
  const postWords = snapshot.posts.map(post => {
    const fields = post.locales[locale];
    return new Set(fields ? [...tokenize(fields.title.value), ...fields.description.paragraphs.flatMap(p => tokenize(p))] : []);
  });
  const candidates = new Map<string, { value: string; count: number }>();
  snapshot.experiences.flatMap(e => e.technologies).forEach(technology => {
    const key = technologyKey(technology.value);
    const tokens = tokenize(technology.value);
    if (candidates.has(key) || tokens.length !== 1) {
      return;
    }
    candidates.set(key, { value: technology.value, count: postWords.filter(words => words.has(tokens[0])).length });
  });
  const [best] = [...candidates.entries()]
    .filter(([, c]) => c.count > 0)
    .sort(([keyA, a], [keyB, b]) => (b.count - a.count) || compareKeys(keyA, keyB));
  return best?.[1].value;
}

/**
 * Starter questions for an empty conversation, built from the data and the supported forms.
 * A suggestion is only offered when it answers on this snapshot in this locale.
 */
export function suggestedQuestions(snapshot: KnowledgeSnapshot, locale: Locale): SuggestedQuestion[] {
  const q = ANSWER_TEMPLATES[locale].questions;
  const latest = latestExperience(snapshot);
  const technology = mostListedTechnology(snapshot);
  const topic = mostWrittenAboutTechnology(snapshot, locale);
  const candidates: (SuggestedQuestion | null)[] = [
    { intent: "profile", question: q.profile },
    { intent: "currentRole", question: q.currentRole },
    { intent: "employers", question: q.employers },
    latest ? { intent: "companyTechnologies", question: q.companyTechnologies(latest.companyName.value) } : null,
    technology ? { intent: "technologyExperience", question: q.technologyExperience(technology) } : null,
    topic ? { intent: "postSearch", question: q.postSearch(topic) } : null,
    { intent: "posts", question: q.posts },
    { intent: "hobbies", question: q.hobbies }
  ];
  return candidates.filter((c): c is SuggestedQuestion => c !== null
    && answer(c.question, locale, snapshot, false).kind === "answered");
}

/** The answer's text content in reading order (used for the screen-reader announcement). */
export function answerPlainText(blocks: readonly AnswerBlock[]): string {
  return blocks.map(block => {
    switch (block.kind) {
      case "text": return block.line.text;
      case "list": return [block.intro.text, ...block.items.map(item => item.text)].join("\n");
      case "values": return `${block.intro.text} ${block.values.map(v => v.value).join(", ")}`;
      case "excerpt": return block.excerpt.paragraphs.join("\n");
    }
  }).join("\n");
}
