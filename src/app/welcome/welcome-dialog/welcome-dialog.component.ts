import { Component, OnInit, Input } from "@angular/core";
import { TypingAnimationDirective } from "./welcome-dialog-typing/typing-animation.directive";

@Component({
    selector: "app-welcome-dialog",
    templateUrl: "./welcome-dialog.component.html",
    styleUrls: ["./welcome-dialog.css", "./welcome-dialog.responsivity.css"],
    imports: [TypingAnimationDirective]
})

export class WelcomeDialogComponent {

    constructor() {}

}
