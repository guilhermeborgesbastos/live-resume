import { Component, OnInit, HostListener } from "@angular/core";
import { debounce } from "../core/utils";
import { HeaderComponent } from "../header/header.component";
import { NgClass } from "@angular/common";
import { WelcomeComponent } from "../welcome/welcome.component";
import { InViewportDirective } from "../core/directive/on-viewport.directive";
import { AboutComponent } from "../about/about.component";
import { ExperienceComponent } from "../experience/experience.component";
import { PostsComponent } from "../posts/posts.component";
import { ContactComponent } from "../contact/contact.component";
import { FooterComponent } from "../footer/footer.component";

@Component({
    selector: "app-resume",
    templateUrl: "./resume.component.html",
    styleUrls: ["./resume.component.css", "./resume.component.responsivity.css"],
    imports: [HeaderComponent, NgClass, WelcomeComponent, InViewportDirective, AboutComponent, ExperienceComponent, PostsComponent, ContactComponent, FooterComponent]
})
export class ResumeComponent {

  isSticky: boolean = false;
  activeSection: string;

  pageYOffset: number = 0;
  pageXOffset: number;

  constructor() {
    this.checkResize();
  }

  @HostListener("window:scroll")
  @debounce()
  checkScroll() {
    this.pageYOffset = window.pageYOffset;
    this.isSticky = pageYOffset >= 250;
  }

  @HostListener("window:resize")
  @debounce(25)
  checkResize() {
    this.pageXOffset = window.innerWidth;
  }

  @debounce(150)
  onViewport(isOnViewPort: any, element?: string) {
    this.activeSection = element;
  }
}
