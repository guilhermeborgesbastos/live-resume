import { Component, input, output } from "@angular/core";

@Component({
  selector: "app-assistant-suggestions",
  templateUrl: "./assistant-suggestions.component.html",
  styleUrls: ["./assistant-suggestions.component.scss"]
})
export class AssistantSuggestionsComponent {
  readonly questions = input.required<readonly string[]>();
  readonly heading = input<string>("");
  readonly disabled = input(false);
  readonly picked = output<string>();
}
