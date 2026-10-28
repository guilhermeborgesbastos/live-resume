/*
 * Everything the function derives from the CV data bundled at deploy time, built once per
 * instance: the validated snapshot and notes, one evidence map, prompt and schema per locale,
 * and the CV names the grounding checks look for.
 */
import { parseAssistantContext, ContextNote } from "../../../src/app/assistant/knowledge/assistant-context";
import { buildEvidenceMap, evidenceText, EvidenceMap, knowledgeVersion, stableHash } from "../../../src/app/assistant/knowledge/evidence-map";
import { adaptKnowledge, RawKnowledge } from "../../../src/app/assistant/knowledge/knowledge-adapter";
import { ASSISTANT_LOCALES, KnowledgeSnapshot, Locale } from "../../../src/app/assistant/models/assistant.models";
import { CvOwner, instructions } from "./prompt";
import { answerSchema } from "./schema";

/**
 * The longest user turn: a 500-character question, two history pairs of 500 + 600 characters,
 * and the tags around them, at a conservative 2 characters per token.
 */
const MAX_USER_TURN_TOKENS = 1_500;
const CHARACTERS_PER_TOKEN_FLOOR = 2;

export interface LocaleKnowledge {
  readonly map: EvidenceMap;
  readonly system: readonly [string, string];
  readonly schema: Record<string, unknown>;
  /** CV names (companies, technologies, schools, ...) in this locale, longest first. */
  readonly names: readonly string[];
  /** An upper bound on a request's input tokens, for the monthly cost reservation. */
  readonly maxInputTokens: number;
}

export interface HostedKnowledge {
  readonly version: string;
  /** Identifies the notes file, for logs and evaluation reports. */
  readonly contextVersion: string;
  readonly snapshot: KnowledgeSnapshot;
  readonly notes: readonly ContextNote[];
  readonly experienceIds: readonly number[];
  readonly locales: Readonly<Record<Locale, LocaleKnowledge>>;
}

/** Throws if the JSON or the notes are invalid: the deploy build validates both first. */
export function buildHostedKnowledge(raw: RawKnowledge, notesSource: string, owner: CvOwner): HostedKnowledge {
  const snapshot = adaptKnowledge(raw);
  const experienceIds = snapshot.experiences.map(e => e.id);
  const parsed = parseAssistantContext(notesSource, { experienceIds });
  if (parsed.errors.length) {
    throw new Error(`Invalid assistant-context.txt: ${parsed.errors.join("; ")}`);
  }
  const locales = {} as Record<Locale, LocaleKnowledge>;
  for (const locale of ASSISTANT_LOCALES) {
    const map = buildEvidenceMap(snapshot, parsed.notes, locale);
    const system: [string, string] = [instructions(locale, owner), evidenceText(map)];
    locales[locale] = {
      map,
      system,
      schema: answerSchema(map, experienceIds),
      names: cvNames(snapshot, locale),
      maxInputTokens: Math.ceil((system[0].length + system[1].length) / CHARACTERS_PER_TOKEN_FLOOR) + MAX_USER_TURN_TOKENS
    };
  }
  return {
    version: knowledgeVersion(raw),
    contextVersion: stableHash(notesSource),
    snapshot,
    notes: parsed.notes,
    experienceIds,
    locales
  };
}

/** Names that, when an answer mentions them, must appear in the text of the evidence it cites. */
export function cvNames(snapshot: KnowledgeSnapshot, locale: Locale): string[] {
  const names = new Set<string>();
  const add = (name: string | undefined) => {
    const value = name?.trim();
    if (value && value.length >= 2) {
      names.add(value);
    }
  };
  for (const experience of snapshot.experiences) {
    add(experience.companyName.value);
    for (const technology of experience.technologies) {
      add(technology.value);
      add(technology.value.split(" (")[0]); // "Java (Android)" also names "Java"
    }
  }
  const about = snapshot.about;
  about.education.forEach(e => add(e.school.value));
  about.certifications.forEach(c => {
    add(c.name.value);
    add(c.issuer.value);
  });
  about.languages.forEach(l => add(l.locales[locale]?.name.value));
  about.medias.forEach(m => add(m.title.value));
  // Hobby titles ("Read", "Gym") are everyday words, so they're left out to avoid rejecting plain prose.
  return [...names].sort((a, b) => b.length - a.length || a.localeCompare(b));
}
