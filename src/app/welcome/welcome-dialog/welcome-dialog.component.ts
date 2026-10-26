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
}
