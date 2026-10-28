import { Component, computed, input, output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { SourceRef } from "../../models/assistant.models";
import { citationLink, InternalLink } from "../citations";

interface SourceLinkView {
  readonly key: string;
  readonly label: string;
  /** Null for a note, which is shown as a plain label. */
  readonly link: InternalLink | null;
  readonly externalUrl?: string;
}

@Component({
  selector: "app-assistant-source-links",
  templateUrl: "./assistant-source-links.component.html",
  styleUrls: ["./assistant-source-links.component.scss"],
  imports: [RouterLink, FaIconComponent]
})
export class AssistantSourceLinksComponent {
  readonly sources = input.required<readonly SourceRef[]>();
  /** Emitted when an internal citation is followed (the panel closes itself). */
  readonly followed = output<void>();

  readonly faExternalLinkAlt = faExternalLinkAlt;

  readonly links = computed<SourceLinkView[]>(() => this.sources().map(source => ({
    key: `${source.file}:${source.recordKey}`,
    label: source.label,
    link: citationLink(source.target),
    ...(source.externalUrl ? { externalUrl: source.externalUrl } : {})
  })));
}
