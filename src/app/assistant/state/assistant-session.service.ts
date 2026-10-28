import { Injectable, LOCALE_ID, computed, effect, inject, signal } from "@angular/core";
import { ConversationContext, HostedAnswerKind, KnowledgeSnapshot, Locale, PairAnswer, QuestionError } from "../models/assistant.models";
import { AssistantKnowledgeService } from "../knowledge/assistant-knowledge.service";
import { answerQuestion, suggestedQuestions, SuggestedQuestion, validateQuestion } from "../engine/assistant-engine";
import { HostedAnswerService } from "../api/hosted-answer.service";
import { historyFor, isHostedEligible, toPairAnswer } from "../api/hosted-answer";

export const MAX_CONVERSATION_PAIRS = 50;

export interface ConversationPair {
  readonly id: number;
  readonly question: string;
  readonly answer: PairAnswer;
}

interface ConversationState {
  readonly pairs: readonly ConversationPair[];
  readonly draft: string;
  readonly panelOpen: boolean;
  /** True once older pairs were dropped to stay within MAX_CONVERSATION_PAIRS. */
  readonly trimmed: boolean;
  readonly validationError: QuestionError | null;
  /** A question asked before the CV data finished loading. */
  readonly pendingQuestion: string | null;
  /** The visitor chose to keep every question in the browser (no AI answers) for this tab. */
  readonly localOnly: boolean;
}

const EMPTY_STATE: ConversationState = {
  pairs: [],
  draft: "",
  panelOpen: false,
  trimmed: false,
  validationError: null,
  pendingQuestion: null,
  localOnly: false
};

export function siteLocale(localeId: string): Locale {
  return localeId.toLowerCase().startsWith("pt") ? "pt" : "en";
}

/**
 * The one in-memory conversation shared by the floating panel and the /assistant page. It
 * survives route changes inside the SPA and is lost on refresh, tab close or locale switch (the
 * locale links load the other build). Nothing is persisted. Questions the local engine can't
 * answer go to the hosted AI answers when they're enabled and the visitor hasn't chosen
 * local-only; nothing else leaves the browser.
 */
@Injectable({ providedIn: "root" })
export class AssistantSessionService {
  private knowledge = inject(AssistantKnowledgeService);
  private hosted = inject(HostedAnswerService);
  readonly locale = siteLocale(inject(LOCALE_ID));

  private readonly conversations = new Map([[this.locale, signal<ConversationState>(EMPTY_STATE)]]);
  private readonly state = this.conversations.get(this.locale)!;
  private nextId = 1;
  private submitting = false;
  /** Bumped by clear(), so a hosted reply that arrives afterwards is dropped. */
  private generation = 0;

  readonly pairs = computed(() => this.state().pairs);
  readonly draft = computed(() => this.state().draft);
  readonly panelOpen = computed(() => this.state().panelOpen);
  readonly trimmed = computed(() => this.state().trimmed);
  readonly validationError = computed(() => this.state().validationError);
  readonly localOnly = computed(() => this.state().localOnly);
  readonly knowledgeStatus = computed(() => this.knowledge.state().status);
  readonly ready = computed(() => this.knowledgeStatus() === "ready");
  /** Whether AI answers exist in this build (the notice and the local-only switch show only then). */
  readonly hostedAvailable = this.hosted.enabled;
  /** A question is waiting for its AI answer; new questions wait until it arrives. */
  readonly busy = computed(() => this.state().pairs.some(pair => pair.answer.kind === HostedAnswerKind.Pending));
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
    if (!this.state().localOnly) {
      this.hosted.prepare();
    }
  }

  retry(): void {
    this.knowledge.retry();
  }

  setDraft(draft: string): void {
    this.update({ draft, validationError: null });
  }

  setLocalOnly(localOnly: boolean): void {
    this.update({ localOnly });
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
    if (this.submitting || this.busy()) {
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
      const context = this.context();
      const local = answerQuestion(validation.question, this.locale, knowledge.snapshot, context);
      const hosted = this.hosted.enabled && !this.state().localOnly && isHostedEligible(local);
      const history = historyFor(this.state().pairs);
      const id = this.nextId++;
      this.append({ id, question: validation.question, answer: hosted ? { kind: HostedAnswerKind.Pending } : local });
      if (hosted) {
        this.askHosted(id, validation.question, knowledge.snapshot, knowledge.version, context, history);
      }
    } finally {
      this.submitting = false;
    }
    return true;
  }

  clear(): void {
    this.generation++;
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

  private askHosted(id: number, question: string, snapshot: KnowledgeSnapshot, version: string, context: ConversationContext,
                    history: ReturnType<typeof historyFor>): void {
    const generation = this.generation;
    this.hosted.ask({
      question,
      locale: this.locale,
      knowledgeVersion: version,
      ...(context.experienceId !== undefined ? { context: { experienceId: context.experienceId } } : {}),
      ...(history.length ? { history } : {})
    })
      .then(result => toPairAnswer(result, snapshot, this.locale))
      .catch((): PairAnswer => ({ kind: HostedAnswerKind.Unavailable }))
      .then(answer => {
        if (generation === this.generation) {
          this.update({ pairs: this.state().pairs.map(pair => pair.id === id ? { ...pair, answer } : pair) });
        }
      });
  }

  private append(pair: ConversationPair): void {
    const pairs = [...this.state().pairs, pair];
    const overflow = Math.max(0, pairs.length - MAX_CONVERSATION_PAIRS);
    this.update({
      pairs: pairs.slice(overflow),
      trimmed: this.state().trimmed || overflow > 0,
      validationError: null
    });
  }

  /**
   * The referent for follow-ups: the experience the latest answer was about. Any other latest
   * result (a fallback, a clarification) clears it, so "And before that?" never guesses.
   */
  private context(): ConversationContext {
    const pairs = this.state().pairs;
    const latest = pairs[pairs.length - 1]?.answer;
    return (latest?.kind === "answered" || latest?.kind === HostedAnswerKind.Generated) && latest.subject ? latest.subject : {};
  }

  private update(changes: Partial<ConversationState>): void {
    this.state.update(state => ({ ...state, ...changes }));
  }
}
