import { Component, OnInit } from "@angular/core";
import { environment } from '../../environments/environment';
import { WelcomeBackgroundComponent } from "./welcome-background/welcome-background.component";
import { WelcomeDialogComponent } from "./welcome-dialog/welcome-dialog.component";

@Component({
    selector: "app-welcome",
    templateUrl: "./welcome.component.html",
    styleUrls: ["./welcome.component.css", "./welcome-component.responsivity.css"],
    imports: [WelcomeBackgroundComponent, WelcomeDialogComponent]
})

export class WelcomeComponent {

  constructor() {}

  get characterIllustration(): string {
    return environment.personal.caricature;
  }

  get characterName(): string {
    return environment.personal.name;
  }

}
