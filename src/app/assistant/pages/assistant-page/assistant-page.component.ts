import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from "@angular/core";
import { Meta } from "@angular/platform-browser";
import { Router, RouterLink } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { HeaderComponent } from "../../../header/header.component";
import { debounce } from "../../../core/utils";
import { environment } from "../../../../environments/environment";
import { AssistantSessionService } from "../../state/assistant-session.service";
import { AssistantChatComponent } from "../../ui/chat/assistant-chat.component";

const OWNER_NAME = environment.personal.name;
const PAGE_DESCRIPTION = $localize`:assistant@@assistant.page.description:Ask questions about the experience, skills and posts listed in ${OWNER_NAME}:ownerName:'s CV.`;

/** The full-page conversation (not a dialog). The floating panel is not rendered on this route. */
@Component({
  selector: "app-assistant-page",
  templateUrl: "./assistant-page.component.html",
  styleUrls: ["./assistant-page.component.scss", "./assistant-page.component.responsivity.scss"],
  imports: [RouterLink, FaIconComponent, HeaderComponent, AssistantChatComponent]
})
export class AssistantPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private meta = inject(Meta);
  private router = inject(Router);
  readonly session = inject(AssistantSessionService);

  readonly faArrowLeft = faArrowLeft;
  pageXOffset = window.innerWidth;

  @ViewChild("heading", { static: true }) heading: ElementRef<HTMLHeadingElement>;
  @ViewChild(AssistantChatComponent, { static: true }) chat: AssistantChatComponent;

  private previousDescription: string | null = null;
  // Set when the panel's "expand" button brought the visitor here mid-conversation.
  private readonly focusComposer = !!this.router.currentNavigation()?.extras.state?.["focusComposer"];

  ngOnInit(): void {
    this.session.closePanel();
    this.previousDescription = this.meta.getTag("name='description'")?.content ?? null;
    this.meta.updateTag({ name: "description", content: PAGE_DESCRIPTION });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  ngAfterViewInit(): void {
    if (this.focusComposer) {
      this.chat.focusComposer();
    } else {
      this.heading.nativeElement.focus({ preventScroll: true });
    }
  }

  ngOnDestroy(): void {
    if (this.previousDescription !== null) {
      this.meta.updateTag({ name: "description", content: this.previousDescription });
    }
  }

  @HostListener("window:resize")
  @debounce(25)
  checkResize() {
    this.pageXOffset = window.innerWidth;
  }
}
