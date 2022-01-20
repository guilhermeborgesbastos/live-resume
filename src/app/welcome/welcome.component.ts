import { Component, OnInit } from "@angular/core";
import { environment } from '../../environments/environment';

@Component({
  selector: "app-welcome",
  templateUrl: "./welcome.component.html",
  styleUrls: ["./welcome.component.css", "./welcome-component.responsivity.css"]
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
