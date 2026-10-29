import { describe, expect, it } from "vitest";
import { CheckName, CheckStatus, ModelAnswerStatus } from "../src/core/constants";
import { checkAnswer } from "../src/core/validate-answer";
import { knowledge } from "./helpers";

const k = knowledge();
const en = k.locales.en;
const pt = k.locales.pt;
const reply = (paragraphs: { text: string; evidence: unknown[] }[], extra: Record<string, unknown> = {}) =>
  ({ status: ModelAnswerStatus.Answered, partial: false, subjectExperienceId: null, paragraphs, ...extra });

describe("checkAnswer", () => {
  it("accepts an answer whose numbers and names are in the cited facts", () => {
    const result = checkAnswer(reply([{
      text: "At Swisscom AG I work as a Senior Full-stack DevOps Engineer, a role listed as ongoing since May 2020, with Java, Kubernetes and Docker.",
      evidence: ["exp.6", "exp.6.tech"]
    }], { subjectExperienceId: 6 }), en, "en");
    expect(result).toEqual({
      status: CheckStatus.Answered,
      partial: false,
      subjectExperienceId: 6,
      paragraphs: [expect.objectContaining({ evidence: ["exp.6", "exp.6.tech"] })]
    });
  });

  it("answers from a note, quoting its year", () => {
    expect(checkAnswer(reply([{ text: "I have worked with Java since 2014.", evidence: ["ctx.java-experience"] }]), en, "en").status).toBe(CheckStatus.Answered);
  });

  it("passes unsupported through, but not with text", () => {
    expect(checkAnswer({ status: ModelAnswerStatus.Unsupported, partial: false, subjectExperienceId: null, paragraphs: [] }, en, "en")).toEqual({ status: CheckStatus.Unsupported });
    expect(checkAnswer({ status: ModelAnswerStatus.Unsupported, partial: false, subjectExperienceId: null, paragraphs: [{ text: "x", evidence: [] }] }, en, "en"))
      .toEqual({ status: CheckStatus.Invalid, check: CheckName.UnsupportedWithText });
  });

  const invalid: [string, unknown, CheckName][] = [
    ["a computed duration", reply([{ text: "I have 12 years of Java experience.", evidence: ["ctx.java-experience"] }]), CheckName.Number],
    ["a technology not on the cited role", reply([{ text: "At SkyDreamer I used Kubernetes.", evidence: ["exp.4", "exp.4.tech"] }]), CheckName.Name],
    ["a company not in the cited facts", reply([{ text: "I worked with Java at Swisscom AG.", evidence: ["ctx.java-experience"] }]), CheckName.Name],
    ["salary", reply([{ text: "My salary at Swisscom AG is confidential.", evidence: ["exp.6"] }]), CheckName.GuardedTopic],
    ["availability", reply([{ text: "I am available to start at Swisscom AG soon.", evidence: ["exp.6"] }]), CheckName.GuardedTopic],
    ["years with a technology", reply([{ text: "I have over 10 years of experience with web development.", evidence: ["about.description"] }]), CheckName.GuardedTopic],
    ["a URL", reply([{ text: "See www.example.com for my Swisscom AG work.", evidence: ["exp.6"] }]), CheckName.Markup],
    ["an unknown evidence ID", reply([{ text: "Something.", evidence: ["exp.99"] }]), CheckName.UnknownEvidence],
    ["a non-string evidence ID", reply([{ text: "Something.", evidence: [6] }]), CheckName.UnknownEvidence],
    ["no evidence", reply([{ text: "Something.", evidence: [] }]), CheckName.EvidenceCount],
    ["four paragraphs", reply(Array(4).fill({ text: "Something.", evidence: ["about.description"] })), CheckName.ParagraphCount],
    ["a long paragraph", reply([{ text: "word ".repeat(170), evidence: ["about.description"] }]), CheckName.ParagraphLength],
    ["a long answer", reply(Array(3).fill({ text: "word ".repeat(120), evidence: ["about.description"] })), CheckName.AnswerLength],
    ["the other language", reply([{ text: "Eu trabalho com Java desde 2014 e uso o Java para o meu trabalho.", evidence: ["ctx.java-experience"] }]), CheckName.Language],
    ["a broken shape", { status: "maybe" }, CheckName.Shape]
  ];
  invalid.forEach(([name, input, check]) =>
    it(`rejects ${name}`, () => expect(checkAnswer(input, en, "en")).toEqual({ status: CheckStatus.Invalid, check })));

  it("accepts a summary paragraph of up to 800 characters", () => {
    const text = "word ".repeat(140).trim();
    expect(text.length).toBeGreaterThan(600);
    expect(checkAnswer(reply([{ text, evidence: ["about.description"] }]), en, "en").status).toBe(CheckStatus.Answered);
  });

  it("allows a guarded topic when a cited note says it", () => {
    const result = checkAnswer(reply([{ text: "I hold an EU work permit.", evidence: ["ctx.relocation"] }]), en, "en");
    expect(result.status).toBe(CheckStatus.Answered);
  });

  it("checks Portuguese answers in Portuguese", () => {
    expect(checkAnswer(reply([{ text: "Trabalho com Java desde 2014, em vários dos meus cargos.", evidence: ["ctx.java-experience"] }]), pt, "pt").status)
      .toBe(CheckStatus.Answered);
  });

  it("drops a subject that isn't the only cited role", () => {
    const result = checkAnswer(reply([{ text: "I worked at Swisscom AG and QAT Global.", evidence: ["exp.6", "exp.5"] }], { subjectExperienceId: 6 }), en, "en");
    expect(result).toEqual(expect.objectContaining({ status: CheckStatus.Answered }));
    expect(result).not.toHaveProperty("subjectExperienceId");
  });
});
