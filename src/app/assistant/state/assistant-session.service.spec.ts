import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { DataService } from "../../core/data.service";
import { AssistantKnowledgeService } from "../knowledge/assistant-knowledge.service";
import { realCv } from "../testing/assistant-fixtures";
import { AssistantSessionService, MAX_CONVERSATION_PAIRS, siteLocale } from "./assistant-session.service";

const FILES = ["about", "experiences", "posts"] as const;

describe("CV assistant knowledge and session", () => {
  let http: HttpTestingController;

  function setUp(locale = "en"): void {
    TestBed.configureTestingModule({
      providers: [DataService, provideHttpClient(), provideHttpClientTesting(), { provide: LOCALE_ID, useValue: locale }]
    });
    http = TestBed.inject(HttpTestingController);
  }

  function respond(overrides: Partial<Record<typeof FILES[number], unknown>> = {}): void {
    const cv = realCv();
    FILES.forEach(file => http.expectOne(`assets/data/${file}.json`).flush(overrides[file] ?? cv[file]));
    TestBed.tick();
  }

  beforeEach(() => http = undefined as any);
  afterEach(() => http?.verify());

  describe("knowledge service", () => {
    beforeEach(() => setUp());

    it("loads the three files once and reuses the validated snapshot", () => {
      const knowledge = TestBed.inject(AssistantKnowledgeService);
      knowledge.load();
      knowledge.load();
      expect(knowledge.state().status).toBe("loading");
      respond();
      const state = knowledge.state();
      expect(state.status).toBe("ready");
      knowledge.load();
      http.expectNone("assets/data/about.json");
      expect(knowledge.state()).toBe(state);
    });

    it("fails closed when one asset fails and loads everything again on retry", () => {
      spyOn(console, "error"); // DataService logs the failed request.
      const knowledge = TestBed.inject(AssistantKnowledgeService);
      knowledge.load();
      http.expectOne("assets/data/about.json").flush(realCv().about);
      http.expectOne("assets/data/experiences.json").flush(realCv().experiences);
      http.expectOne("assets/data/posts.json").flush("missing", { status: 404, statusText: "Not Found" });
      expect(knowledge.state().status).toBe("error");

      knowledge.retry();
      respond();
      expect(knowledge.state().status).toBe("ready");
    });

    it("fails closed on data that does not validate", () => {
      spyOn(console, "warn");
      const knowledge = TestBed.inject(AssistantKnowledgeService);
      knowledge.load();
      respond({ experiences: { not: "an array" } });
      expect(knowledge.state().status).toBe("error");
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe("session", () => {
    let session: AssistantSessionService;

    beforeEach(() => {
      setUp();
      session = TestBed.inject(AssistantSessionService);
      session.ensureLoaded();
      respond();
    });

    it("is shared by every consumer (panel, page, welcome)", () => {
      const other = TestBed.inject(AssistantSessionService);
      session.setDraft("Where have you used Java?");
      expect(other.draft()).toBe("Where have you used Java?");
      expect(other.submitDraft()).toBeTrue();
      expect(session.pairs().length).toBe(1);
      expect(session.pairs()[0].answer.kind).toBe("answered");
      expect(session.draft()).toBe("");
      other.openPanel();
      expect(session.panelOpen()).toBeTrue();
    });

    it("validates input without adding an answer", () => {
      session.setDraft("   ");
      expect(session.submitDraft()).toBeFalse();
      expect(session.validationError()).toBe("empty");
      session.setDraft("x".repeat(501));
      expect(session.submitDraft()).toBeFalse();
      expect(session.validationError()).toBe("too-long");
      expect(session.draft()).toBe("x".repeat(501));
      expect(session.pairs()).toEqual([]);
      session.setDraft("ok");
      expect(session.validationError()).toBeNull();
    });

    it("records fallbacks like answers", () => {
      session.ask("What salary are you looking for?");
      expect(session.pairs()[0].answer).toEqual({ kind: "fallback", reason: "unrecognized" });
    });

    it(`keeps at most ${MAX_CONVERSATION_PAIRS} pairs, dropping the oldest`, () => {
      for (let i = 0; i < MAX_CONVERSATION_PAIRS + 3; i++) {
        session.ask(`What is your current role? ${i}`);
      }
      const pairs = session.pairs();
      expect(pairs.length).toBe(MAX_CONVERSATION_PAIRS);
      expect(pairs[0].question).toBe("What is your current role? 3");
      expect(pairs[pairs.length - 1].question).toBe(`What is your current role? ${MAX_CONVERSATION_PAIRS + 2}`);
      expect(session.trimmed()).toBeTrue();
    });

    it("clears messages and draft but keeps the loaded data", () => {
      session.ask("What are your hobbies?");
      session.setDraft("unsent");
      session.clear();
      expect(session.pairs()).toEqual([]);
      expect(session.draft()).toBe("");
      expect(session.trimmed()).toBeFalse();
      expect(session.ready()).toBeTrue();
      expect(session.suggestions().length).toBeGreaterThan(0);
    });
  });

  describe("session before the data is loaded", () => {
    it("answers a queued shortcut exactly once when the data arrives", () => {
      setUp("pt");
      const session = TestBed.inject(AssistantSessionService);
      expect(session.locale).toBe("pt");
      expect(session.ask("Qual é o seu cargo atual?")).toBeTrue();
      expect(session.pairs()).toEqual([]);
      respond();
      TestBed.tick();
      expect(session.pairs().length).toBe(1);
      expect(session.pairs()[0].answer.kind).toBe("answered");
    });
  });

  it("normalizes the site locale", () => {
    expect(siteLocale("pt")).toBe("pt");
    expect(siteLocale("pt-BR")).toBe("pt");
    expect(siteLocale("en-US")).toBe("en");
  });
});
