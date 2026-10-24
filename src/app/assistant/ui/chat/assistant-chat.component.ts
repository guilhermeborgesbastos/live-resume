import { Component, ElementRef, OnInit, ViewChild, afterRenderEffect, computed, inject, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faRedo, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import { answerPlainText } from "../../engine/assistant-engine";
import { AssistantSessionService } from "../../state/assistant-session.service";
import { ASSISTANT_COPY } from "../assistant-copy";
import { CONTACT_LINK } from "../citations";
import { AssistantComposerComponent } from "../composer/assistant-composer.component";
import { AssistantConversationComponent } from "../conversation/assistant-conversation.component";
import { AssistantSuggestionsComponent } from "../suggestions/assistant-suggestions.component";

/**
 * The conversation UI used by both the /assistant page and the floating panel: status,
 * suggestions, transcript, composer and the polite live region. All state lives in the session.
 */
@Component({
  selector: "app-assistant-chat",
  templateUrl: "./assistant-chat.component.html",
  styleUrls: ["./assistant-chat.component.scss"],
  imports: [RouterLink, FaIconComponent, AssistantComposerComponent, AssistantConversationComponent, AssistantSuggestionsComponent],
  host: { "[class.compact]": "compact()" }
})
export class AssistantChatComponent implements OnInit {
  readonly session = inject(AssistantSessionService);
  private host = inject(ElementRef<HTMLElement>);

  /** The panel scrolls its own message area; the page scrolls the document. */
  readonly compact = input(false);
  /** Emitted when an internal link (citation or contact) is followed. */
  readonly navigated = output<void>();

  readonly contactLink = CONTACT_LINK;
  readonly faRedo = faRedo;
  readonly faTrashAlt = faTrashAlt;

  readonly suggestionTexts = computed(() => this.session.suggestions().map(s => s.question));
  readonly fallbackSuggestions = computed(() => this.suggestionTexts().slice(0, 3));

  /** Text of the latest answer only, so screen readers never re-read the whole history. */
  readonly announcement = computed(() => {
    const pairs = this.session.pairs();
    const answer = pairs[pairs.length - 1]?.answer;
    switch (answer?.kind) {
      case "answered": return answerPlainText(answer.blocks);
      case "fallback": return ASSISTANT_COPY.fallback;
      case "unavailable": return ASSISTANT_COPY.unavailable;
      default: return "";
    }
  });

  @ViewChild(AssistantComposerComponent) composer?: AssistantComposerComponent;
  @ViewChild("scroller", { static: true }) scroller: ElementRef<HTMLElement>;

  /** Latest pair already scrolled into view; undefined until the first render. */
  private shownPairId: number | null | undefined;

  constructor() {
    afterRenderEffect(() => {
      const pairs = this.session.pairs();
      const latest = pairs.length > 0 ? pairs[pairs.length - 1].id : null;
      const restored = this.shownPairId === undefined;
      if (latest === this.shownPairId) {
        return;
      }
      this.shownPairId = latest;
      const question = latest === null ? null : this.host.nativeElement.querySelector(`[data-pair="${latest}"]`) as HTMLElement | null;
      if (!question) {
        return;
      }
      if (restored) {
        // Reopening with history: show the end of the conversation (the page keeps its own scroll).
        if (this.compact()) {
          this.scroller.nativeElement.scrollTop = this.scroller.nativeElement.scrollHeight;
        }
      } else if (this.compact()) {
        // A new answer: start reading at its question.
        this.scroller.nativeElement.scrollTop = question.offsetTop - 8;
      } else {
        question.scrollIntoView({ block: "start" });
      }
    });
  }

  ngOnInit(): void {
    this.session.ensureLoaded();
  }

  focusComposer(): void {
    this.composer?.focus();
  }

  submit(): void {
    this.session.submitDraft();
  }

  ask(question: string): void {
    this.session.ask(question);
  }

  clear(): void {
    this.session.clear();
    this.focusComposer();
  }
}
