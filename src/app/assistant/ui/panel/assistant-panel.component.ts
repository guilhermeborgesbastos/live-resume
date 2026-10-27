import { Component, DestroyRef, ElementRef, ViewChild, effect, inject, output } from "@angular/core";
import { NavigationStart, Router } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faExpandAlt, faTimes } from "@fortawesome/free-solid-svg-icons";
import { filter } from "rxjs/operators";
import { AssistantSessionService } from "../../state/assistant-session.service";
import { ASSISTANT_COPY } from "../assistant-copy";
import { AssistantChatComponent } from "../chat/assistant-chat.component";

const SCROLL_LOCK_CLASS = "assistant-scroll-locked";

/**
 * The compact conversation, shown as a modal <dialog>: the browser makes the rest of the page
 * inert (focus stays inside), Escape closes it, and the backdrop covers the page. Background
 * scrolling is locked while it is open and the exact scroll position is restored on close.
 */
@Component({
  selector: "app-assistant-panel",
  templateUrl: "./assistant-panel.component.html",
  styleUrls: ["./assistant-panel.component.scss", "./assistant-panel.component.responsivity.scss"],
  imports: [FaIconComponent, AssistantChatComponent]
})
export class AssistantPanelComponent {
  readonly session = inject(AssistantSessionService);
  private router = inject(Router);

  /** Emitted after the dialog closed, so the opener can take focus back. */
  readonly closed = output<void>();

  readonly copy = ASSISTANT_COPY;
  readonly faTimes = faTimes;
  readonly faExpandAlt = faExpandAlt;

  @ViewChild("dialog", { static: true }) dialog: ElementRef<HTMLDialogElement>;
  @ViewChild(AssistantChatComponent) chat?: AssistantChatComponent;

  private scrollY = 0;
  private destroyed = false;
  private removeViewportListener?: () => void;

  constructor() {
    effect(() => this.session.panelOpen() ? this.show() : this.hide());

    // Any navigation (a citation, the contact link, expanding) closes the panel first.
    const navigation = this.router.events
      .pipe(filter(event => event instanceof NavigationStart))
      .subscribe(() => this.session.closePanel());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      navigation.unsubscribe();
      this.hide();
    });
  }

  close(): void {
    this.session.closePanel();
  }

  expand(): void {
    this.session.closePanel();
    this.router.navigate(["/assistant"], { state: { focusComposer: true } });
  }

  /** Clicks on the dialog element itself land on the backdrop (the sheet fills the content box). */
  onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) {
      this.close();
    }
  }

  /** Fired by the browser after Escape or dialog.close(). */
  onDialogClose(): void {
    this.session.closePanel();
    this.unlockScroll();
    if (!this.destroyed) {
      this.closed.emit();
    }
  }

  private show(): void {
    const dialog = this.dialog.nativeElement;
    if (dialog.open) {
      return;
    }
    this.lockScroll();
    dialog.showModal();
    this.trackVisualViewport();
    // The chat renders in this change detection pass; focus its composer afterwards.
    setTimeout(() => this.chat?.focusComposer());
  }

  private hide(): void {
    const dialog = this.dialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
    // Restore the scroll position now, before a navigation that closed the panel scrolls anywhere.
    this.unlockScroll();
  }

  private lockScroll(): void {
    this.scrollY = window.scrollY;
    document.documentElement.classList.add(SCROLL_LOCK_CLASS);
  }

  private unlockScroll(): void {
    this.removeViewportListener?.();
    this.removeViewportListener = undefined;
    const root = document.documentElement;
    if (root.classList.contains(SCROLL_LOCK_CLASS)) {
      root.classList.remove(SCROLL_LOCK_CLASS);
      window.scrollTo({ top: this.scrollY, behavior: "instant" });
    }
  }

  /** Keeps the sheet above an on-screen keyboard, which shrinks only the visual viewport. */
  private trackVisualViewport(): void {
    const viewport = window.visualViewport;
    if (!viewport || this.removeViewportListener) {
      return;
    }
    const update = () => this.dialog.nativeElement.style.setProperty("--assistant-viewport-height", `${viewport.height}px`);
    update();
    viewport.addEventListener("resize", update);
    this.removeViewportListener = () => {
      viewport.removeEventListener("resize", update);
      this.dialog.nativeElement.style.removeProperty("--assistant-viewport-height");
    };
  }
}
