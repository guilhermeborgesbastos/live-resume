import { Component, ElementRef, ViewChild, computed, input, output } from "@angular/core";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { MAX_QUESTION_LENGTH } from "../../engine/assistant-engine";
import { QuestionError } from "../../models/assistant.models";

let nextComposerId = 0;

@Component({
  selector: "app-assistant-composer",
  templateUrl: "./assistant-composer.component.html",
  styleUrls: ["./assistant-composer.component.scss"],
  imports: [FaIconComponent]
})
export class AssistantComposerComponent {
  readonly draft = input.required<string>();
  readonly disabled = input(false);
  readonly error = input<QuestionError | null>(null);
  readonly draftChange = output<string>();
  readonly submitted = output<void>();

  readonly id = `assistant-question-${nextComposerId++}`;
  readonly maxLength = MAX_QUESTION_LENGTH;
  readonly faPaperPlane = faPaperPlane;
  readonly length = computed(() => [...this.draft()].length);

  @ViewChild("field", { static: true }) field: ElementRef<HTMLTextAreaElement>;

  focus(): void {
    this.field.nativeElement.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter adds a line; never act while an IME composition is in progress.
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  submit(): void {
    if (!this.disabled()) {
      this.submitted.emit();
    }
  }
}
