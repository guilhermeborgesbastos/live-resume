import { adaptKnowledge, KnowledgeValidationError, parseCvDate, RawKnowledge, safeExternalUrl } from "./knowledge-adapter";
import { CvJson, realCv } from "../testing/assistant-fixtures";

function issuesOf(cv: CvJson): readonly string[] {
  try {
    adaptKnowledge(cv as RawKnowledge);
  } catch (error) {
    expect(error).toBeInstanceOf(KnowledgeValidationError);
    return (error as KnowledgeValidationError).issues;
  }
  fail("expected the data to be rejected");
  return [];
}

describe("CV assistant knowledge adapter", () => {

  it("accepts the current CV data with pointers into the real records", () => {
    const cv = realCv();
    const snapshot = adaptKnowledge(cv as RawKnowledge);
    expect(snapshot.experiences.length).toBe(cv.experiences.length);
    expect(snapshot.posts.length).toBe(cv.posts.length);

    const index = cv.experiences.findIndex(e => !e.endAt);
    const ongoing = snapshot.experiences[index];
    expect(ongoing.end).toBeUndefined();
    expect(ongoing.companyName.pointer).toBe(`/${index}/companyName`);
    // The pointer uses the real position of each locale entry in internationalizations.
    const enIndex = cv.experiences[index].internationalizations.findIndex((i: any) => i.language === "en");
    expect(ongoing.locales.en!.role.pointer).toBe(`/${index}/internationalizations/${enIndex}/role`);
    expect(snapshot.about.descriptions.en!.paragraphs.length).toBeGreaterThan(0);
  });

  it("returns a frozen copy and leaves the source JSON unmodified", () => {
    const cv = realCv();
    const before = JSON.stringify(cv);
    const snapshot = adaptKnowledge(cv as RawKnowledge);
    expect(JSON.stringify(cv)).toBe(before);
    expect(Object.isFrozen(snapshot.experiences)).toBeTrue();
    expect(Object.isFrozen(snapshot.experiences[0].technologies)).toBeTrue();
    expect(() => (snapshot.experiences as any[]).sort()).toThrow();
    // Changing the source afterwards does not reach the snapshot.
    cv.experiences[0].companyName = "Changed";
    expect(snapshot.experiences[0].companyName.value).not.toBe("Changed");
  });

  it("parses MM-DD-YYYY explicitly and rejects invalid dates", () => {
    expect(parseCvDate("02-29-2024", "/x")).toEqual(jasmine.objectContaining({ year: 2024, month: 2, day: 29 }));
    ["02-29-2023", "13-01-2020", "00-10-2020", "2020-05-01", "5-1-2020", "04-31-2020", 20200501, null].forEach(raw =>
      expect(parseCvDate(raw, "/x")).withContext(String(raw)).toBeUndefined());
  });

  it("rejects invalid dates in the data", () => {
    const cv = realCv();
    cv.experiences[0].startAt = "2009-02-02";
    cv.posts[0].date = "02-30-2020";
    const issues = issuesOf(cv);
    expect(issues).toContain("experiences.json /0/startAt must be a valid MM-DD-YYYY date");
    expect(issues).toContain("posts.json /0/date must be a valid MM-DD-YYYY date");
  });

  it("rejects duplicate experience IDs and post URLs", () => {
    const cv = realCv();
    cv.experiences[1].id = cv.experiences[0].id;
    cv.posts[1].http = cv.posts[0].http;
    const issues = issuesOf(cv);
    expect(issues.some(i => i.includes("/1/id duplicates experience ID"))).toBeTrue();
    expect(issues.some(i => i.includes("/1/http duplicates another post's URL"))).toBeTrue();
  });

  it("rejects missing locales and required localized fields", () => {
    const cv = realCv();
    cv.experiences[0].internationalizations = cv.experiences[0].internationalizations.filter((i: any) => i.language !== "pt");
    delete cv.posts[0].internationalizations[0].title;
    cv.about.internationalizations[0].language = "fr";
    const issues = issuesOf(cv);
    expect(issues).toContain("experiences.json /0/internationalizations has no \"pt\" entry");
    expect(issues.some(i => i.startsWith("posts.json /0/internationalizations/0/title"))).toBeTrue();
    expect(issues.some(i => i.startsWith("about.json /internationalizations/0/language"))).toBeTrue();
  });

  it("rejects files with the wrong shape", () => {
    expect(issuesOf({ ...realCv(), posts: {} as any })).toContain("posts.json must be an array");
    expect(issuesOf({ ...realCv(), about: [] as any })).toContain("about.json must be an object");
  });

  it("keeps absent optional fields absent", () => {
    const cv = realCv();
    const entry = cv.experiences[0].internationalizations.find((i: any) => i.language === "en");
    delete entry.city;
    delete cv.experiences[0].technologies;
    delete cv.about.hobbies;
    const snapshot = adaptKnowledge(cv as RawKnowledge);
    expect(snapshot.experiences[0].locales.en!.city).toBeUndefined();
    expect(snapshot.experiences[0].locales.pt!.city).toBeDefined();
    expect(snapshot.experiences[0].technologies).toEqual([]);
    expect(snapshot.about.hobbies).toEqual([]);
  });

  it("converts HTML fields to inert text and drops unsafe link schemes", () => {
    const cv = realCv();
    cv.experiences[0].internationalizations[0].role = "<img src=x onerror=alert(1)>Dev<script>alert(2)</script>";
    cv.about.medias[0].http = "javascript:alert(1)";
    cv.posts[0].http = "data:text/html,<script>alert(1)</script>";
    const snapshot = adaptKnowledge(cv as RawKnowledge);
    const language = cv.experiences[0].internationalizations[0].language as "en" | "pt";
    expect(snapshot.experiences[0].locales[language]!.role.value).toBe("Dev");
    expect(snapshot.about.medias[0].url).toBeUndefined();
    // The post stays citable internally by its URL key, but gets no outgoing link.
    expect(snapshot.posts[0].key).toBe(cv.posts[0].http);
    expect(snapshot.posts[0].externalUrl).toBeUndefined();
  });

  it("accepts only http(s) URLs as outgoing links", () => {
    expect(safeExternalUrl("https://github.com/x")).toBe("https://github.com/x");
    expect(safeExternalUrl("http://example.com")).toBe("http://example.com/");
    ["javascript:alert(1)", "data:text/html,x", "ftp://x", "/relative", "", 42].forEach(raw =>
      expect(safeExternalUrl(raw)).withContext(String(raw)).toBeUndefined());
  });
});
