import { ASSISTANT_LOCALES, KnowledgeSnapshot } from "../models/assistant.models";
import { realCv, snapshotOf } from "../testing/assistant-fixtures";
import { ContextNote } from "./assistant-context";
import { buildEvidenceMap, evidenceText, knowledgeVersion, slug, sourcesFor, stableHash } from "./evidence-map";
import { RawKnowledge } from "./knowledge-adapter";

const NOTE: ContextNote = {
  id: "java-experience",
  updated: "2026-10",
  related: [4, 6],
  line: 1,
  locales: { en: { title: "Java experience", text: "A note." }, pt: { title: "Experiência com Java", text: "Uma nota." } }
};

describe("buildEvidenceMap", () => {
  const snapshot = snapshotOf();

  ASSISTANT_LOCALES.forEach(locale => describe(locale, () => {
    const map = buildEvidenceMap(snapshot, [NOTE], locale);

    it("gives every entry a unique, well-formed ID", () => {
      const ids = map.entries.map(e => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach(id => expect(id).toMatch(/^(about|edu|cert|lang|topic|exp|post|ctx)\.[a-z0-9.-]+$/));
    });

    it("covers every experience, technology list, description and post", () => {
      snapshot.experiences.forEach(e => {
        expect(map.byId.get(`exp.${e.id}`)?.experienceId).toBe(e.id);
        expect(map.byId.has(`exp.${e.id}.desc`)).toBeTrue();
        expect(map.byId.has(`exp.${e.id}.tech`)).toBe(e.technologies.length > 0);
      });
      snapshot.posts.forEach(p => expect(map.byId.has(`post.${stableHash(p.key)}`)).withContext(p.key).toBeTrue());
    });

    it("names the company in every experience sub-entry, so names can be checked against cited text", () => {
      snapshot.experiences.forEach(e =>
        map.entries.filter(entry => entry.id.startsWith(`exp.${e.id}`)).forEach(entry =>
          expect(entry.text).withContext(entry.id).toContain(e.companyName.value)));
    });

    it("sends plain text only: no HTML, no URLs, no line breaks", () => {
      const text = evidenceText(map);
      expect(text).not.toMatch(/<\s*\/?\s*[a-z]/i);
      expect(text).not.toMatch(/https?:\/\//);
      map.entries.forEach(e => expect(e.text).not.toContain("\n"));
    });

    it("turns a note into a labelled citation without a link, followed by its related roles", () => {
      const note = map.byId.get("ctx.java-experience")!;
      expect(note.source.target).toEqual({ section: "notes", noteId: "java-experience" });
      expect(note.source.label).toBe(locale === "en" ? "My notes · Java experience (Oct 2026)" : "Minhas anotações · Experiência com Java (out. 2026)");
      const sources = sourcesFor(map, ["ctx.java-experience"]);
      expect(sources.map(s => s.recordKey)).toEqual(["java-experience", "4", "6"]);
    });
  }));

  it("merges citations of the same record and ignores unknown IDs", () => {
    const map = buildEvidenceMap(snapshot, [], "en");
    const sources = sourcesFor(map, ["exp.6", "exp.6.tech", "nope", "exp.6.desc"]);
    expect(sources.length).toBe(1);
    expect(sources[0].target).toEqual({ section: "experience", experienceId: 6 });
    expect(sources[0].pointers.length).toBeGreaterThan(3);
  });

  it("keeps IDs and text when records are reordered in the JSON", () => {
    const cv = realCv();
    const reordered = realCv();
    reordered.experiences.reverse();
    reordered.posts.reverse();
    const text = (data: typeof cv) => evidenceText(buildEvidenceMap(snapshotOf(data), [], "en"));
    expect(text(reordered)).toBe(text(cv));
  });

  it("leaves out a record that has no fields in the active locale", () => {
    const onlyEnglish: KnowledgeSnapshot = {
      ...snapshot,
      experiences: snapshot.experiences.map(e => e.id === 6 ? { ...e, locales: { en: e.locales.en } } : e)
    };
    expect(buildEvidenceMap(onlyEnglish, [], "en").byId.has("exp.6")).toBeTrue();
    expect(buildEvidenceMap(onlyEnglish, [], "pt").byId.has("exp.6")).toBeFalse();
  });
});

describe("knowledgeVersion", () => {
  const raw = (): RawKnowledge => realCv();

  it("ignores key order and changes with any value", () => {
    const base = knowledgeVersion(raw());
    const reordered = raw() as any;
    reordered.experiences[0] = Object.fromEntries(Object.entries(reordered.experiences[0]).reverse());
    expect(knowledgeVersion(reordered)).toBe(base);
    const changed = raw() as any;
    changed.experiences[0].companyName += " ";
    expect(knowledgeVersion(changed)).not.toBe(base);
    expect(base).toMatch(/^v1-[0-9a-f]{8}-[0-9a-f]+$/);
  });
});

describe("slug", () => {
  it("makes lowercase ASCII IDs", () => {
    expect(slug("Universidade de Uberaba (UNIUBE)")).toBe("universidade-de-uberaba-uniube");
    expect(slug("Pós-graduação")).toBe("pos-graduacao");
    expect(slug("!!!")).toBe("x");
  });
});
