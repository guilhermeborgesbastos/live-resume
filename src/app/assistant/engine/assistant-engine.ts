/*
 * The CV assistant's deterministic answer engine. Pure: no Angular, HTTP, storage, clock,
 * randomness or conversation history. The same question, locale and snapshot always give the
 * same answer, sources and order.
 */
import { AnswerBlock, AnswerResult, ExperienceRecord, IntentId, KnowledgeSnapshot, Locale } from "../models/assistant.models";
import { ANSWER_TEMPLATES } from "./answer-templates";
import { byStartDescending, compareKeys, composeAnswer } from "./compose-answer";
import { normalizeUtterance, technologyKey, tokenize, validateQuestion } from "./normalize-question";
import { Interpretation, resolveQuestion } from "./resolve-question";

export { validateQuestion, MAX_QUESTION_LENGTH } from "./normalize-question";

export interface SuggestedQuestion {
  readonly intent: IntentId;
  readonly question: string;
}

export function answerQuestion(question: string, locale: Locale, snapshot: KnowledgeSnapshot | null): AnswerResult {
  return answer(question, locale, snapshot, true);
}

function answer(question: string, locale: Locale, snapshot: KnowledgeSnapshot | null, withFollowUps: boolean): AnswerResult {
  if (!snapshot) {
    return { kind: "unavailable" };
  }
  const validation = validateQuestion(question);
  if ("error" in validation) {
    return { kind: "fallback", reason: "unrecognized" };
  }
  const resolution = resolveQuestion(validation.question, snapshot);
  if (resolution.kind === "rejected") {
    return { kind: "fallback", reason: resolution.reason };
  }
  const { interpretation } = resolution;
  const composed = composeAnswer(interpretation, snapshot, locale);
  if (!composed) {
    return { kind: "fallback", reason: interpretation.intent === "postSearch" ? "no-results" : "missing-fact" };
  }
  const followUps = withFollowUps
    ? answerable(followUpCandidates(interpretation, snapshot, locale), locale, snapshot)
      .filter(q => normalizeUtterance(q) !== normalizeUtterance(validation.question))
    : [];
  return { kind: "answered", intent: interpretation.intent, blocks: composed.blocks, sources: composed.sources, followUps };
}

function answerable(questions: string[], locale: Locale, snapshot: KnowledgeSnapshot): string[] {
  return questions.filter((q, i) => questions.indexOf(q) === i && answer(q, locale, snapshot, false).kind === "answered");
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
