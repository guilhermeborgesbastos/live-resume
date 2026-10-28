import { describe, expect, it } from "vitest";
import { knowledgeVersion } from "../../src/app/assistant/knowledge/evidence-map";
import { buildHostedKnowledge } from "../src/core/knowledge";
import { knowledge, NOTES, OWNER, rawCv } from "./helpers";

describe("buildHostedKnowledge", () => {
  it("builds byte-identical prompts and schemas from the same data", () => {
    const a = knowledge();
    const b = knowledge();
    expect(JSON.stringify(a.locales)).toBe(JSON.stringify(b.locales));
    expect(a.version).toBe(knowledgeVersion(rawCv()));
  });

  it("puts every evidence ID in the schema enum and the notes in the prompt", () => {
    const en = knowledge().locales.en;
    const items = (en.schema as any).properties.paragraphs.items.properties.evidence.items.enum as string[];
    expect(items).toEqual(en.map.entries.map(e => e.id));
    expect(items).toContain("ctx.java-experience");
    expect(en.system[1]).toContain("[ctx.java-experience] Java experience: I have worked with Java since 2014. (updated Oct 2026)");
    expect(en.system[0]).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no dates: the cached prefix must not change daily
  });

  it("names the CV owner from configuration, not from code", () => {
    const instructions = knowledge().locales.en.system[0];
    expect(instructions).toContain(`the online CV of ${OWNER.name}, published on ${OWNER.firstName}'s own website`);
    expect(instructions).toContain(`Speak as ${OWNER.firstName}`);
    expect(instructions).not.toContain("Guilherme");
  });

  it("bounds a request's input tokens above the prompt itself", () => {
    const en = knowledge().locales.en;
    expect(en.maxInputTokens).toBeGreaterThan((en.system[0].length + en.system[1].length) / 4);
  });

  it("lists CV names for the name check, without everyday hobby words", () => {
    const names = knowledge().locales.en.names;
    expect(names).toEqual(expect.arrayContaining(["Swisscom AG", "Java", "Kubernetes", "QAT Global"]));
    expect(names).not.toContain("Read");
  });

  it("refuses invalid notes", () => {
    expect(() => buildHostedKnowledge(rawCv(), NOTES.replace("pt: Trabalho com Java desde 2014.\n", ""), OWNER)).toThrow(/"pt" is required/);
  });

  it("works with no notes", () => {
    expect(knowledge("# none yet\n").notes).toEqual([]);
  });
});
