import { Component, LOCALE_ID, inject } from "@angular/core";
import { TypingAnimationDirective } from "./welcome-dialog-typing/typing-animation.directive";

@Component({
    selector: "app-welcome-dialog",
    templateUrl: "./welcome-dialog.component.html",
    styleUrls: ["./welcome-dialog.css", "./welcome-dialog.responsivity.css"],
    imports: [TypingAnimationDirective]
})

export class WelcomeDialogComponent {
    private locale = inject(LOCALE_ID);

    readonly phrases = [
        {
            "language": "pt",
            "phrases": [ "Bem-vindo! Eu sou o Guilherme.", "Role para baixo e explore meu CV...", "ou pergunte ao meu Assistente de IA :)" ]
        },
        {
            "language": "en",
            "phrases": [ "Welcome! I'm Guilherme.", "Scroll down to explore my resume...", "...or just ask my AI Assistant :)" ]
        }
    ];

    readonly stablePhrases = this.phrases
        .filter(entry => entry.language === (this.locale || "en"))
        .flatMap(entry => entry.phrases)
        .join(" ");
}
