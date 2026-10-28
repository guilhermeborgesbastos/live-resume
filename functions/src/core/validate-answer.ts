/*
 * Deterministic checks on the model's reply before anything reaches a visitor. They
 * catch the obvious inventions: a number or a CV name that isn't in the cited facts, a topic the
 * CV doesn't cover, links or markup, the wrong language. They can't prove that a sentence follows
 * from its sources; the evaluation set is the release gate for that.
 */
import { contentProblems } from "../../../src/app/assistant/knowledge/assistant-context";
import { ASSISTANT_LOCALES, Locale } from "../../../src/app/assistant/models/assistant.models";
import {
  GeneratedParagraph, MAX_ANSWER_LENGTH, MAX_EVIDENCE_PER_PARAGRAPH, MAX_PARAGRAPH_LENGTH, MAX_PARAGRAPHS
} from "../../../src/app/assistant/models/hosted-answer.models";
import { CheckName, CheckStatus, ModelAnswerStatus } from "./constants";
import type { LocaleKnowledge } from "./knowledge";
import type { ModelAnswer } from "./schema";

export type CheckedAnswer =
  | { readonly status: CheckStatus.Answered; readonly paragraphs: readonly GeneratedParagraph[]; readonly partial: boolean; readonly subjectExperienceId?: number }
  | { readonly status: CheckStatus.Unsupported }
  | { readonly status: CheckStatus.Invalid; readonly check: CheckName };

/**
 * Topics the CV assistant must not speak to unless a cited fact uses the same words. Lowercase
 * regular expressions, matched against lowercased text, EN and PT together (an answer can quote
 * either).
 */
const GUARDED_TOPICS: readonly RegExp[] = [
  /\bsalar(y|ies|io|ios)\b|\bsalário|\bhourly rate\b|\bday rate\b|\bpretensão salarial\b|\bremunera/,
  /\bvisa\b|\bvisto\b|\bwork permit\b|\bwork authori[sz]ation\b|\bautorização de trabalho\b|\bpermissão de trabalho\b|\bsponsorship\b/,
  /\bavailab(le|ility) (to start|for|from|immediately)\b|\bnotice period\b|\bdisponível para\b|\bdisponibilidade\b|\baviso prévio\b/,
  // "N years with/in X", "N years of X", "N years of experience with/in X"; a general "N years of experience" isn't guarded.
  /\b\d+\+? years? (?:of experience (?:with|in) |(?:with|in) |of (?!experience\b))\w|\b\d+\+? anos (?:de experiência (?:com|em) |(?:com|em) |de (?!experiência\b))\S/
];

const STOP_WORDS: Record<Locale, readonly string[]> = {
  en: ["the", "and", "of", "to", "in", "at", "with", "for", "is", "was", "my", "i", "on", "as", "it", "this"],
  pt: ["de", "e", "o", "a", "em", "com", "para", "do", "da", "no", "na", "que", "meu", "minha", "os", "as", "um", "uma"]
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `name` occurs in `text` as a whole word (or symbol run, for names like "C#" or "CI/CD"). */
function mentions(text: string, name: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(name)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function numbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map(n => n.replace(/[.,]/g, ""));
}

function languageMatches(text: string, locale: Locale): boolean {
  const words = text.toLowerCase().split(/[^\p{L}]+/u);
  const count = (l: Locale) => words.filter(w => STOP_WORDS[l].includes(w)).length;
  const own = count(locale);
  const other = ASSISTANT_LOCALES.filter(l => l !== locale).reduce((sum, l) => sum + count(l), 0);
  return own + other < 3 || own > other;
}

export function checkAnswer(reply: unknown, knowledge: LocaleKnowledge, locale: Locale): CheckedAnswer {
  const invalid = (check: CheckName): CheckedAnswer => ({ status: CheckStatus.Invalid, check });
  if (!reply || typeof reply !== "object") {
    return invalid(CheckName.Shape);
  }
  const answer = reply as ModelAnswer;
  if (answer.status === ModelAnswerStatus.Unsupported) {
    return Array.isArray(answer.paragraphs) && answer.paragraphs.length === 0 ? { status: CheckStatus.Unsupported } : invalid(CheckName.UnsupportedWithText);
  }
  if (answer.status !== ModelAnswerStatus.Answered || !Array.isArray(answer.paragraphs) || typeof answer.partial !== "boolean") {
    return invalid(CheckName.Shape);
  }
  if (answer.paragraphs.length < 1 || answer.paragraphs.length > MAX_PARAGRAPHS) {
    return invalid(CheckName.ParagraphCount);
  }

  const paragraphs: GeneratedParagraph[] = [];
  let total = 0;
  for (const paragraph of answer.paragraphs) {
    const text = typeof paragraph?.text === "string" ? paragraph.text.replace(/\s+/g, " ").trim() : "";
    const rawEvidence: unknown[] = Array.isArray(paragraph?.evidence) ? paragraph.evidence : [];
    if (rawEvidence.some(id => typeof id !== "string")) {
      return invalid(CheckName.UnknownEvidence);
    }
    const evidence = [...new Set(rawEvidence as string[])];
    total += text.length;
    if (!text || text.length > MAX_PARAGRAPH_LENGTH) {
      return invalid(CheckName.ParagraphLength);
    }
    if (evidence.length < 1 || evidence.length > MAX_EVIDENCE_PER_PARAGRAPH) {
      return invalid(CheckName.EvidenceCount);
    }
    const entries = evidence.map(id => knowledge.map.byId.get(id));
    if (entries.some(e => !e)) {
      return invalid(CheckName.UnknownEvidence);
    }
    const cited = entries.map(e => e!.text).join("\n");
    const citedNumbers = new Set(numbers(cited));
    if (numbers(text).some(n => !citedNumbers.has(n))) {
      return invalid(CheckName.Number);
    }
    if (knowledge.names.some(name => mentions(text, name) && !mentions(cited, name))) {
      return invalid(CheckName.Name);
    }
    const lower = text.toLowerCase();
    const citedLower = cited.toLowerCase();
    if (GUARDED_TOPICS.some(topic => topic.test(lower) && !topic.test(citedLower))) {
      return invalid(CheckName.GuardedTopic);
    }
    if (contentProblems(text).length) {
      return invalid(CheckName.Markup);
    }
    paragraphs.push({ text, evidence });
  }
  if (total > MAX_ANSWER_LENGTH) {
    return invalid(CheckName.AnswerLength);
  }
  if (!languageMatches(paragraphs.map(p => p.text).join(" "), locale)) {
    return invalid(CheckName.Language);
  }

  const citedExperiences = new Set(paragraphs.flatMap(p => p.evidence).map(id => knowledge.map.byId.get(id)!.experienceId).filter(id => id !== undefined));
  const subject = answer.subjectExperienceId;
  const keepSubject = typeof subject === "number" && citedExperiences.size === 1 && citedExperiences.has(subject);
  return { status: CheckStatus.Answered, paragraphs, partial: answer.partial, ...(keepSubject ? { subjectExperienceId: subject } : {}) };
}
