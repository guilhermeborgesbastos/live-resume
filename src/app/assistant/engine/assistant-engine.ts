/*
 * The CV assistant's deterministic answer engine. Pure: no Angular, HTTP, storage, clock or
 * randomness. The same question, locale, snapshot and context always give the same answer,
 * sources and order. The only conversation input is the explicit `context` (the experience the
 * previous answer was about), used by follow-ups such as "And before that?".
 */
import {
  AnswerBlock, AnswerResult, ClarifyReason, ConversationContext, ExperienceRecord, FallbackReason, IntentId, KnowledgeSnapshot,
  Locale
} from "../models/assistant.models";
import { ANSWER_TEMPLATES } from "./answer-templates";
import { byStartDescending, compareKeys, ComposedAnswer, composeAnswer } from "./compose-answer";
import { entityKey, normalizeUtterance, technologyKey, tokenize, validateQuestion } from "./normalize-question";
import { Interpretation, resolveQuestion, technologyBaseKey } from "./resolve-question";

export { validateQuestion, MAX_QUESTION_LENGTH } from "./normalize-question";

export interface SuggestedQuestion {
  readonly intent: IntentId;
  readonly question: string;
}

/** At most this many "did you mean" options are offered. */
const MAX_CLARIFY_OPTIONS = 3;

/** A question resolved against the snapshot and, when it resolved, composed from it. */
type Outcome =
  | { readonly kind: "composed"; readonly interpretation: Interpretation; readonly composed: ComposedAnswer }
  | { readonly kind: "clarify"; readonly why: ClarifyReason; readonly options: readonly Interpretation[] }
  | { readonly kind: "fallback"; readonly reason: FallbackReason };

/** Resolves and composes a question: the evidence checks every answer and probe goes through. */
function resolveAndCompose(question: string, locale: Locale, snapshot: KnowledgeSnapshot, context: ConversationContext): Outcome {
  const validation = validateQuestion(question);
  if ("error" in validation) {
    return { kind: "fallback", reason: "unrecognized" };
  }
  const resolution = resolveQuestion(validation.question, snapshot, context);
  if (resolution.kind === "rejected") {
    return { kind: "fallback", reason: resolution.reason };
  }
  if (resolution.kind === "clarify") {
    return { kind: "clarify", why: resolution.why, options: resolution.options };
  }
  const { interpretation } = resolution;
  const composed = composeAnswer(interpretation, snapshot, locale);
  if (!composed) {
    return { kind: "fallback", reason: interpretation.intent === "postSearch" ? "no-results" : "missing-fact" };
  }
  return { kind: "composed", interpretation, composed };
}

/**
 * Whether a question the engine offers (suggestion, follow-up, "did you mean" option) answers as
 * it is, without context: it must resolve to one interpretation whose answer composes.
 */
function isAnswerable(question: string, locale: Locale, snapshot: KnowledgeSnapshot): boolean {
  return resolveAndCompose(question, locale, snapshot, {}).kind === "composed";
}

/** The distinct questions among `questions` that answer on this snapshot, in order. */
function answerableQuestions(questions: readonly (string | null)[], locale: Locale, snapshot: KnowledgeSnapshot): string[] {
  return questions.filter((q, i): q is string => q !== null && questions.indexOf(q) === i && isAnswerable(q, locale, snapshot));
}

/** Answers a visitor's question, with verified follow-ups or "did you mean" options. */
export function answerQuestion(question: string, locale: Locale, snapshot: KnowledgeSnapshot | null, context: ConversationContext = {}): AnswerResult {
  if (!snapshot) {
    return { kind: "unavailable" };
  }
  const outcome = resolveAndCompose(question, locale, snapshot, context);
  switch (outcome.kind) {
    case "fallback":
      return { kind: "fallback", reason: outcome.reason };
    case "clarify":
      return clarification(outcome.why, outcome.options, locale, snapshot);
    case "composed":
      return answered(question, outcome.interpretation, outcome.composed, locale, snapshot);
  }
}

/** Offers each reading as a supported question the visitor confirms by asking it. */
function clarification(why: ClarifyReason, readings: readonly Interpretation[], locale: Locale, snapshot: KnowledgeSnapshot): AnswerResult {
  const options = answerableQuestions(readings.map(reading => canonicalQuestion(reading, snapshot, locale)), locale, snapshot)
    .slice(0, MAX_CLARIFY_OPTIONS);
  return options.length > 0
    ? { kind: "clarify", reason: why, options }
    : { kind: "fallback", reason: why === "typo" ? "unknown-entity" : "ambiguous" };
}

function answered(question: string, interpretation: Interpretation, composed: ComposedAnswer, locale: Locale, snapshot: KnowledgeSnapshot): AnswerResult {
  const followUps = answerableQuestions(followUpCandidates(interpretation, snapshot, locale), locale, snapshot)
    .filter(q => normalizeUtterance(q) !== normalizeUtterance(question));
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

/** The single experience an answer was about: the referent for the next follow-up. */
function subjectOf(interpretation: Interpretation, snapshot: KnowledgeSnapshot): ConversationContext | null {
  if ("experience" in interpretation) {
    return { experienceId: interpretation.experience.id };
  }
  if (interpretation.intent === "topicSummary" && interpretation.topic.experienceIds.length === 1) {
    return { experienceId: interpretation.topic.experienceIds[0] };
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
  switch (interpretation.intent) {
    case "profile": return q.profile;
    case "employers": return q.employers;
    case "currentRole": return q.currentRole;
    case "technologies": return q.technologies;
    case "posts": return q.posts;
    case "hobbies": return q.hobbies;
    case "socialLinks": return q.socialLinks;
    case "education": return q.education;
    case "certifications": return q.certifications;
    case "languages": return q.languages;
    case "companyOverview": return q.companyOverview(interpretation.experience.companyName.value);
    case "companyRole": return q.companyRole(interpretation.experience.companyName.value);
    case "companyDates": return q.companyDates(interpretation.experience.companyName.value);
    case "companyLocation": return q.companyLocation(interpretation.experience.companyName.value);
    case "companyTechnologies": return q.companyTechnologies(interpretation.experience.companyName.value);
    case "companyHighlights": return q.companyHighlights(interpretation.experience.companyName.value);
    case "technologyExperience": {
      const technology = technologyDisplay(interpretation.technology, snapshot);
      return technology && q.technologyExperience(technology);
    }
    case "technologyAtCompany": {
      const technology = technologyDisplay(interpretation.technology, snapshot);
      return technology && q.technologyAtCompany(technology, interpretation.experience.companyName.value);
    }
    case "postSearch": return q.postSearch(interpretation.topicTokens.join(" "));
    case "postSummary": {
      const fields = interpretation.post.locales[locale];
      return fields ? q.postSummary(fields.title.value) : null;
    }
    case "socialLink": return q.socialLink(interpretation.media.title.value);
    case "issuerCertifications": {
      const issuer = interpretation.issuer;
      const certification = snapshot.about.certifications.find(c => entityKey(c.issuer.value) === issuer);
      return certification ? q.issuerCertifications(certification.issuer.value) : null;
    }
    case "languageProficiency": {
      const fields = interpretation.language.locales[locale];
      return fields ? q.languageProficiency(fields.name.value) : null;
    }
    case "topicSummary": {
      const fields = interpretation.topic.locales[locale];
      return fields ? q.topicSummary(fields.name.value) : null;
    }
  }
}

function latestExperience(snapshot: KnowledgeSnapshot): ExperienceRecord | undefined {
  return [...snapshot.experiences].sort(byStartDescending)[0];
}

function followUpCandidates(interpretation: Interpretation, snapshot: KnowledgeSnapshot, locale: Locale): string[] {
  const q = ANSWER_TEMPLATES[locale].questions;
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
    case "companyOverview": {
      const company = interpretation.experience.companyName.value;
      return [q.companyHighlights(company), q.companyTechnologies(company), q.companyDates(company)];
    }
    case "companyRole":
    case "companyDates":
    case "companyLocation":
    case "companyTechnologies":
    case "companyHighlights":
      return [q.companyOverview(interpretation.experience.companyName.value)];
    case "education":
      return [q.certifications];
    case "certifications":
    case "issuerCertifications":
      return [q.education, q.languages];
    case "languages":
    case "languageProficiency":
      return [q.education];
    case "topicSummary": {
      const { experienceIds } = interpretation.topic;
      const latest = [...snapshot.experiences].sort(byStartDescending).find(e => experienceIds.includes(e.id));
      return latest ? [q.companyHighlights(latest.companyName.value)] : [];
    }
    case "technologyAtCompany":
      return [q.companyTechnologies(interpretation.experience.companyName.value)];
    case "technologyExperience": {
      const key = interpretation.technology;
      const first = [...snapshot.experiences].sort(byStartDescending)
        .find(e => e.technologies.some(t => technologyKey(t.value) === key));
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
  const area = snapshot.about.topics[0]?.locales[locale]?.name.value;
  const candidates: (SuggestedQuestion | null)[] = [
    { intent: "profile", question: q.profile },
    { intent: "currentRole", question: q.currentRole },
    { intent: "employers", question: q.employers },
    latest ? { intent: "companyTechnologies", question: q.companyTechnologies(latest.companyName.value) } : null,
    area ? { intent: "topicSummary", question: q.topicSummary(area) } : null,
    technology ? { intent: "technologyExperience", question: q.technologyExperience(technology) } : null,
    topic ? { intent: "postSearch", question: q.postSearch(topic) } : null,
    { intent: "certifications", question: q.certifications },
    { intent: "posts", question: q.posts },
    { intent: "hobbies", question: q.hobbies }
  ];
  return candidates.filter((c): c is SuggestedQuestion => c !== null && isAnswerable(c.question, locale, snapshot));
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
