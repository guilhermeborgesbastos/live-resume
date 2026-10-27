/* Test helpers: the real CV JSON, isolated mutable copies of it, and provenance checks. */
import about from "../../../assets/data/about.json";
import experiences from "../../../assets/data/experiences.json";
import posts from "../../../assets/data/posts.json";
import { adaptKnowledge, RawKnowledge } from "../knowledge/knowledge-adapter";
import { htmlToLine, htmlToParagraphs } from "../knowledge/plain-text";
import { ANSWER_TEMPLATES } from "../engine/answer-templates";
import { AnswerResult, KnowledgeSnapshot, Locale, SourceFile, SourcedText } from "../models/assistant.models";

export interface CvJson {
  about: any;
  experiences: any[];
  posts: any[];
}

/** A deep copy of the real CV data that a test may change freely. */
export function realCv(): CvJson {
  return JSON.parse(JSON.stringify({ about, experiences, posts }));
}

export function snapshotOf(cv: CvJson = realCv()): KnowledgeSnapshot {
  return adaptKnowledge(cv as RawKnowledge);
}

export function resolvePointer(document: unknown, pointer: string): unknown {
  return pointer.split("/").slice(1).reduce<any>((value, key) => value?.[key], document);
}

function fileOf(cv: CvJson, file: SourceFile): unknown {
  return file === "about.json" ? cv.about : file === "experiences.json" ? cv.experiences : cv.posts;
}

/**
 * Asserts that every fact and excerpt in an answer is cited by one of its sources and equals the
 * JSON value at its pointer (as plain text). Returns the number of checked values.
 */
export function expectGrounded(answer: AnswerResult, cv: CvJson, locale: Locale): number {
  expect(answer.kind).toBe("answered");
  if (answer.kind !== "answered") {
    return 0;
  }
  expect(answer.sources.length).withContext("sources").toBeGreaterThan(0);
  const fileFor = (pointer: string): SourceFile => {
    const source = answer.sources.find(s => s.pointers.includes(pointer));
    expect(source).withContext(`no source cites ${pointer}`).toBeDefined();
    return source!.file;
  };
  let checked = 0;
  const checkFact = (fact: SourcedText) => {
    const raw = resolvePointer(fileOf(cv, fileFor(fact.pointer)), fact.pointer);
    expect(typeof raw).withContext(`${fact.pointer} exists`).toBe("string");
    const candidates = [htmlToLine(raw as string), (raw as string).trim()];
    try {
      candidates.push(new URL(raw as string).href);
    } catch { /* not a URL */ }
    const translation = ANSWER_TEMPLATES[locale].hobbyTitles?.[raw as string];
    if (translation && /^\/hobbies\/\d+\/title$/.test(fact.pointer)) {
      candidates.push(translation);
    }
    expect(candidates).withContext(fact.pointer).toContain(fact.value);
    checked++;
  };
  answer.blocks.forEach(block => {
    switch (block.kind) {
      case "text": block.line.facts.forEach(checkFact); break;
      case "list": [block.intro, ...block.items].forEach(line => line.facts.forEach(checkFact)); break;
      case "values": block.intro.facts.forEach(checkFact); block.values.forEach(checkFact); break;
      case "excerpt": {
        const raw = resolvePointer(fileOf(cv, fileFor(block.excerpt.pointer)), block.excerpt.pointer) as string;
        expect(block.excerpt.paragraphs).toEqual(htmlToParagraphs(raw));
        checked++;
        break;
      }
    }
  });
  return checked;
}

/** All visible answer text, for meaning assertions. */
export function answerText(answer: AnswerResult): string {
  if (answer.kind !== "answered") {
    return "";
  }
  return answer.blocks.map(block => {
    switch (block.kind) {
      case "text": return block.line.text;
      case "list": return [block.intro.text, ...block.items.map(i => i.text)].join("\n");
      case "values": return [block.intro.text, ...block.values.map(v => v.value)].join("\n");
      case "excerpt": return block.excerpt.paragraphs.join("\n");
    }
  }).join("\n");
}
