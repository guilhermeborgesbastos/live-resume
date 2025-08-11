import { Component, OnInit } from "@angular/core";
import { faGithubSquare, IconDefinition } from "@fortawesome/free-brands-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { DatePipe } from "@angular/common";

@Component({
    selector: "app-footer",
    templateUrl: "./footer.component.html",
    styleUrls: ["./footer.component.css", "./footer.component.responsivity.css"],
    imports: [FaIconComponent, DatePipe]
})
export class FooterComponent implements OnInit {

  faGithubSquare: IconDefinition;

  year: Date;

  constructor() { }

  ngOnInit(): void {
    this.faGithubSquare = faGithubSquare;
    this.year = new Date();
  }

}
