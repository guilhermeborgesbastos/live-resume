import { Component, ElementRef, ViewChild, inject, input } from "@angular/core";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faComments } from "@fortawesome/free-solid-svg-icons";
import { AssistantSessionService } from "../../state/assistant-session.service";
import { ASSISTANT_COPY } from "../assistant-copy";
import { AssistantPanelComponent } from "../panel/assistant-panel.component";

/** The fixed "Ask about my CV" button on the resume and the panel it opens. */
@Component({
  selector: "app-assistant-launcher",
  templateUrl: "./assistant-launcher.component.html",
  styleUrls: ["./assistant-launcher.component.scss"],
  imports: [FaIconComponent, AssistantPanelComponent]
})
export class AssistantLauncherComponent {
  readonly session = inject(AssistantSessionService);
  /** False hides the button (it stays in the DOM so the open panel is unaffected). */
  readonly available = input(true);

  readonly label = ASSISTANT_COPY.openPanel;
  readonly faComments = faComments;

  @ViewChild("button", { static: true }) button: ElementRef<HTMLButtonElement>;

  open(): void {
    this.session.openPanel();
  }

  restoreFocus(): void {
    // The button is gone when the panel closed because of a navigation away from the resume.
    if (this.button.nativeElement.isConnected && this.available()) {
      this.button.nativeElement.focus({ preventScroll: true });
    }
  }
}
