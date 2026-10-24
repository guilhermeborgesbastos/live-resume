import { Component, LOCALE_ID, OnInit, computed, inject } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faComments } from "@fortawesome/free-solid-svg-icons";
import { TypingAnimationDirective } from "./welcome-dialog-typing/typing-animation.directive";
import { AssistantSessionService } from "../../assistant/state/assistant-session.service";

// Suggestions short enough to sit under the bubble; each is still checked against the CV data.
const SHORTCUT_INTENTS = ["currentRole", "postSearch"];

@Component({
    selector: "app-welcome-dialog",
    templateUrl: "./welcome-dialog.component.html",
    styleUrls: ["./welcome-dialog.css", "./welcome-dialog.responsivity.css"],
    imports: [TypingAnimationDirective, RouterLink, FaIconComponent]
})

export class WelcomeDialogComponent implements OnInit {
    private locale = inject(LOCALE_ID);
    private router = inject(Router);
    private session = inject(AssistantSessionService);

    readonly faComments = faComments;

    readonly phrases = [
        {
            "language": "pt",
            "phrases": [ "Meu nome é Guilherme.", "Bem-vindo ao meu Currículo Interativo.", "Role para baixo e saiba mais sobre mim... :)" ]
        },
        {
            "language": "en",
            "phrases": [ "My name is Guilherme.", "Welcome to my Interactive Resume.", "Scroll down to learn more about me... :)" ]
        }
    ];

    readonly stablePhrases = this.phrases
        .filter(entry => entry.language === (this.locale || "en"))
        .flatMap(entry => entry.phrases)
        .join(" ");

    readonly shortcuts = computed(() => this.session.suggestions()
        .filter(suggestion => SHORTCUT_INTENTS.includes(suggestion.intent))
        .map(suggestion => suggestion.question));

    dispatching = false;

    ngOnInit(): void {
        // Loads the CV data so the shortcuts can be checked; the CTA works before that.
        this.session.ensureLoaded();
    }

    /** Asks the shortcut once through the shared session (never via the URL) and opens the page. */
    askShortcut(question: string): void {
        if (this.dispatching) {
            return;
        }
        this.dispatching = true;
        this.session.ask(question);
        this.router.navigate(["/assistant"]);
    }
}
