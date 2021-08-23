import { Component, OnInit, OnDestroy } from "@angular/core";
import { DataService } from "../core/data.service";
import { IAbout } from "./about-interfaces";
import { FaIconLibrary } from "@fortawesome/angular-fontawesome";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { Subscription } from "rxjs";

@Component({
  selector: "app-about",
  templateUrl: "./about.component.html",
  styleUrls: ["./about.component.scss", "./about.component.responsivity.scss"]
})
export class AboutComponent implements OnInit, OnDestroy {

  name: string;
  yearsOld: number;

  subscription: Subscription;
  aboutData: IAbout;

  constructor(
    private dataService: DataService,
    private library: FaIconLibrary
  ) {
    library.addIconPacks(fas, fab);
  }

  ngOnInit(): void {
    this.name = "Guilherme Borges Bastos"; // Sets here, your full name
    this.yearsOld = this.calcAge("1993-06-29"); // Sets here, your date birthday

    // Fetches the About information from the Data Service (about.json file).
    this.subscription = this.dataService.getAbout()
        .subscribe((about: IAbout) => this.aboutData = about);
  }
  
  ngOnDestroy() {
    // Only need to unsubscribe if its a multi event Observable
    this.subscription.unsubscribe();
  }

  private calcAge(dateString: string) {
    const birthday: Date = new Date(dateString);
    const ageDifMs: number = Date.now() - birthday.getTime();
    const ageDate: Date = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getFullYear() - 1970);
  }
}
