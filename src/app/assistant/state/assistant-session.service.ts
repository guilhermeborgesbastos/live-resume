import { Injectable, LOCALE_ID, computed, effect, inject, signal } from "@angular/core";
import { AnswerResult, ConversationContext, Locale, QuestionError } from "../models/assistant.models";
import { AssistantKnowledgeService } from "../knowledge/assistant-knowledge.service";
import { answerQuestion, suggestedQuestions, SuggestedQuestion, validateQuestion } from "../engine/assistant-engine";

export const MAX_CONVERSATION_PAIRS = 50;

export interface ConversationPair {
  readonly id: number;
  readonly question: string;
  readonly answer: AnswerResult;
}

interface ConversationState {
  readonly pairs: readonly ConversationPair[];
  readonly draft: string;
  readonly panelOpen: boolean;
  /** True once older pairs were dropped to stay within MAX_CONVERSATION_PAIRS. */
  readonly trimmed: boolean;
  readonly validationError: QuestionError | null;
  /** A question asked (e.g. from a welcome shortcut) before the CV data finished loading. */
  readonly pendingQuestion: string | null;
}

const EMPTY_STATE: ConversationState = {
  pairs: [],
  draft: "",
  panelOpen: false,
  trimmed: false,
  validationError: null,
  pendingQuestion: null
};

export function siteLocale(localeId: string): Locale {
  return localeId.toLowerCase().startsWith("pt") ? "pt" : "en";
}

/**
 * The one in-memory conversation shared by the floating panel, the /assistant page and the
 * welcome shortcuts. It survives route changes inside the SPA and is lost on refresh, tab close
 * or locale switch (the locale links load the other build). Nothing is persisted or sent anywhere.
 */
@Injectable({ providedIn: "root" })
export class AssistantSessionService {
  private knowledge = inject(AssistantKnowledgeService);
  readonly locale = siteLocale(inject(LOCALE_ID));

  private readonly conversations = new Map([[this.locale, signal<ConversationState>(EMPTY_STATE)]]);
  private readonly state = this.conversations.get(this.locale)!;
  private nextId = 1;
  private submitting = false;

  readonly pairs = computed(() => this.state().pairs);
  readonly draft = computed(() => this.state().draft);
  readonly panelOpen = computed(() => this.state().panelOpen);
  readonly trimmed = computed(() => this.state().trimmed);
  readonly validationError = computed(() => this.state().validationError);
  readonly knowledgeStatus = computed(() => this.knowledge.state().status);
  readonly ready = computed(() => this.knowledgeStatus() === "ready");
  readonly suggestions = computed<SuggestedQuestion[]>(() => {
    const state = this.knowledge.state();
    return state.status === "ready" ? suggestedQuestions(state.snapshot, this.locale) : [];
  });

  constructor() {
    // Answer a question queued before the data was ready, exactly once.
    effect(() => {
      const pending = this.state().pendingQuestion;
      if (pending !== null && this.ready()) {
        this.update({ pendingQuestion: null });
        this.ask(pending);
      }
    });
  }

  ensureLoaded(): void {
    this.knowledge.load();
  }

  retry(): void {
    this.knowledge.retry();
  }

  setDraft(draft: string): void {
    this.update({ draft, validationError: null });
  }

  /** Validates and asks the current draft; the draft is cleared only when it was accepted. */
  submitDraft(): boolean {
    const validation = validateQuestion(this.draft());
    if ("error" in validation) {
      this.update({ validationError: validation.error });
      return false;
    }
    if (this.ask(validation.question)) {
      this.update({ draft: "" });
      return true;
    }
    return false;
  }

  /** Asks a question (typed, suggested or follow-up). Returns false if it was not accepted. */
  ask(question: string): boolean {
    const validation = validateQuestion(question);
    if ("error" in validation) {
      this.update({ validationError: validation.error });
      return false;
    }
    if (this.submitting) {
      return false;
    }
    const knowledge = this.knowledge.state();
    if (knowledge.status !== "ready") {
      if (knowledge.status === "idle" || knowledge.status === "loading") {
        this.update({ pendingQuestion: validation.question, validationError: null });
        this.ensureLoaded();
        return true;
      }
      return false;
    }
    this.submitting = true;
    try {
      const answer = answerQuestion(validation.question, this.locale, knowledge.snapshot, this.context());
      const pairs = [...this.state().pairs, { id: this.nextId++, question: validation.question, answer }];
      const overflow = Math.max(0, pairs.length - MAX_CONVERSATION_PAIRS);
      this.update({
        pairs: pairs.slice(overflow),
        trimmed: this.state().trimmed || overflow > 0,
        validationError: null
      });
    } finally {
      this.submitting = false;
    }
    return true;
  }

  clear(): void {
    this.update({ pairs: [], draft: "", trimmed: false, validationError: null, pendingQuestion: null });
  }

  openPanel(): void {
    this.update({ panelOpen: true });
  }

  closePanel(): void {
    if (this.state().panelOpen) {
      this.update({ panelOpen: false });
    }
  }

  /**
   * The referent for follow-ups: the experience the latest answer was about. Any other latest
   * result (a fallback, a clarification) clears it, so "And before that?" never guesses.
   */
  private context(): ConversationContext {
    const pairs = this.state().pairs;
    const latest = pairs[pairs.length - 1]?.answer;
    return latest?.kind === "answered" && latest.subject ? latest.subject : {};
  }

  private update(changes: Partial<ConversationState>): void {
    this.state.update(state => ({ ...state, ...changes }));
  }
}
