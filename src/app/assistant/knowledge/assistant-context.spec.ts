import { contentProblems, MAX_NOTES, parseAssistantContext } from "./assistant-context";

const TODAY = { year: 2026, month: 10 };
const OPTIONS = { today: TODAY, experienceIds: [3, 4, 5, 6] };

function note(id: string, overrides: Record<string, string | null> = {}): string {
  const fields: Record<string, string | null> = {
    updated: "2026-10",
    related: "exp.4 exp.6",
    "title.en": "A title",
    "title.pt": "Um título",
    en: "A short note.",
    pt: "Uma nota curta.",
    ...overrides
  };
  const lines = Object.entries(fields).filter(([, value]) => value !== null).map(([key, value]) => `${key}: ${value}`);
  return [`[${id}]`, ...lines].join("\n");
}

describe("parseAssistantContext", () => {
  it("parses notes, ignoring comments and blank lines", () => {
    const source = ["# Comment", "", note("java-experience"), "", "# Another", note("international-work", { related: null })].join("\n");
    const result = parseAssistantContext(source, OPTIONS);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.notes.map(n => n.id)).toEqual(["java-experience", "international-work"]);
    expect(result.notes[0]).toEqual(jasmine.objectContaining({
      updated: "2026-10",
      related: [4, 6],
      line: 3,
      locales: { en: { title: "A title", text: "A short note." }, pt: { title: "Um título", text: "Uma nota curta." } }
    }));
    expect(result.notes[1].related).toEqual([]);
  });

  it("accepts a file with only comments", () => {
    expect(parseAssistantContext("# nothing yet\n\n# still nothing\n", OPTIONS)).toEqual({ notes: [], errors: [], warnings: [] });
  });

  it("accepts commas in related and drops duplicates", () => {
    expect(parseAssistantContext(note("a", { related: "exp.4, exp.4,exp.6" }), OPTIONS).notes[0].related).toEqual([4, 6]);
  });

  it("returns no notes at all when anything is invalid", () => {
    const result = parseAssistantContext([note("good"), "", note("bad", { en: null })].join("\n"), OPTIONS);
    expect(result.notes).toEqual([]);
    expect(result.errors).toEqual(['note "bad" (line 9): "en" is required']);
  });

  const cases: [string, string, RegExp][] = [
    ["bad id", note("Java_Experience"), /lowercase letters, digits and single dashes/],
    ["duplicate id", [note("a"), "", note("a")].join("\n"), /used twice/],
    ["unknown field", note("a", { tags: "x" }), /unknown field "tags"/],
    ["duplicate field", note("a") + "\nen: again", /appears twice/],
    ["text outside a note", "loose text\n\n" + note("a"), /text outside a note/],
    ["continuation line", note("a") + "\nand more words", /expected "field: value"/],
    ["missing title", note("a", { "title.pt": null }), /"title.pt" is required/],
    ["bad updated", note("a", { updated: "2026-13" }), /must be YYYY-MM/],
    ["future updated", note("a", { updated: "2026-11" }), /in the future/],
    ["stale over 24 months", note("a", { updated: "2024-09" }), /over 24 months ago/],
    ["bad related", note("a", { related: "swisscom" }), /must look like exp.<id>/],
    ["unknown related", note("a", { related: "exp.99" }), /experience 99 is not in experiences.json/],
    ["long title", note("a", { "title.en": "x".repeat(61) }), /61 characters; the limit is 60/],
    ["long text", note("a", { pt: "x".repeat(601) }), /601 characters; the limit is 600/],
    ["HTML", note("a", { en: "I used <b>Java</b>." }), /contains HTML/],
    ["URL", note("a", { en: "See https://example.com" }), /contains a URL/]
  ];
  cases.forEach(([name, source, message]) =>
    it(`rejects ${name}`, () => {
      const result = parseAssistantContext(source, OPTIONS);
      expect(result.notes).toEqual([]);
      expect(result.errors.join("\n")).toMatch(message);
    }));

  it("warns, without failing, when a note is over 12 months old", () => {
    const result = parseAssistantContext(note("a", { updated: "2025-09" }), OPTIONS);
    expect(result.errors).toEqual([]);
    expect(result.notes.length).toBe(1);
    expect(result.warnings).toEqual(['note "a" (line 1): last updated 2025-09, over 12 months ago']);
  });

  it("limits the number of notes", () => {
    const source = Array.from({ length: MAX_NOTES + 1 }, (_, i) => note(`n${i}`)).join("\n\n");
    expect(parseAssistantContext(source, OPTIONS).errors).toContain(`${MAX_NOTES + 1} notes; the limit is ${MAX_NOTES}`);
  });

  it("limits the total size per locale", () => {
    const source = Array.from({ length: 10 }, (_, i) => note(`n${i}`, { en: "x".repeat(550) })).join("\n\n");
    expect(parseAssistantContext(source, OPTIONS).errors.join("\n")).toMatch(/the en notes total \d+ characters/);
  });

  it("skips the related check when no experience IDs are given", () => {
    expect(parseAssistantContext(note("a", { related: "exp.99" }), { today: TODAY }).notes[0].related).toEqual([99]);
  });
});

describe("contentProblems", () => {
  it("accepts ordinary prose with years, ranges and punctuation", () => {
    expect(contentProblems("Since 2014 (Android), then 2017-2020 and 2020–2026: Java, C# & .NET; 150+ countries.")).toEqual([]);
  });

  it("flags e-mail addresses, phone numbers and Markdown", () => {
    expect(contentProblems("Write to me@example.com")).toEqual(["contains an e-mail address"]);
    expect(contentProblems("Call +31 6 1234 5678")).toEqual(["contains a phone number"]);
    expect(contentProblems("A [link](somewhere)")).toEqual(["contains Markdown"]);
    expect(contentProblems("**bold** words")).toEqual(["contains Markdown"]);
  });
});
