import { Component, computed, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AnswerBlock, AnswerResult, ClarifyReason, SourceRef } from "../../models/assistant.models";
import { ConversationPair } from "../../state/assistant-session.service";
import { AssistantSourceLinksComponent } from "../source-links/assistant-source-links.component";
import { AssistantSuggestionsComponent } from "../suggestions/assistant-suggestions.component";
import { CONTACT_LINK } from "../citations";

interface BlockView {
  readonly kind: AnswerBlock["kind"];
  readonly text?: string;
  readonly items?: readonly string[];
  readonly values?: readonly string[];
  readonly label?: string;
  readonly paragraphs?: readonly string[];
}

interface PairView {
  readonly id: number;
  readonly question: string;
  readonly kind: AnswerResult["kind"];
  readonly clarifyReason: ClarifyReason | null;
  /** "Did you mean" questions (clarify only). */
  readonly options: readonly string[];
  readonly blocks: readonly BlockView[];
  readonly sources: readonly SourceRef[];
  readonly followUps: readonly string[];
}

function toBlockView(block: AnswerBlock): BlockView {
  switch (block.kind) {
    case "text": return { kind: "text", text: block.line.text };
    case "list": return { kind: "list", text: block.intro.text, items: block.items.map(item => item.text) };
    case "values": return { kind: "values", text: block.intro.text, values: block.values.map(value => value.value) };
    case "excerpt": return { kind: "excerpt", label: block.label, paragraphs: block.excerpt.paragraphs };
  }
}

/** Renders the transcript. Every value is interpolated as text; nothing is bound as HTML. */
@Component({
  selector: "app-assistant-conversation",
  templateUrl: "./assistant-conversation.component.html",
  styleUrls: ["./assistant-conversation.component.scss"],
  imports: [RouterLink, AssistantSourceLinksComponent, AssistantSuggestionsComponent]
})
export class AssistantConversationComponent {
  readonly pairs = input.required<readonly ConversationPair[]>();
  /** Supported questions offered under a fallback (never instead of it). */
  readonly fallbackSuggestions = input<readonly string[]>([]);
  readonly disabled = input(false);
  readonly asked = output<string>();
  readonly navigated = output<void>();

  readonly contactLink = CONTACT_LINK;

  readonly views = computed<PairView[]>(() => this.pairs().map(pair => {
    const answer = pair.answer;
    return {
      id: pair.id,
      question: pair.question,
      kind: answer.kind,
      blocks: answer.kind === "answered" ? answer.blocks.map(toBlockView) : [],
      sources: answer.kind === "answered" ? answer.sources : [],
      followUps: answer.kind === "answered" ? answer.followUps : [],
      clarifyReason: answer.kind === "clarify" ? answer.reason : null,
      options: answer.kind === "clarify" ? answer.options : []
    };
  }));
}
