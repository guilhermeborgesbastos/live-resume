import { Component, HostListener, DestroyRef, ElementRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";
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
import { AssistantLauncherComponent } from "../assistant/ui/launcher/assistant-launcher.component";

// How long a #fragment target is kept in view while the data-driven sections render.
const FRAGMENT_SETTLE_TIME = 2000;

@Component({
    selector: "app-resume",
    templateUrl: "./resume.component.html",
    styleUrls: ["./resume.component.css", "./resume.component.responsivity.css"],
    imports: [HeaderComponent, NgClass, WelcomeComponent, InViewportDirective, AboutComponent, ExperienceComponent, PostsComponent, ContactComponent, FooterComponent, AssistantLauncherComponent]
})
export class ResumeComponent {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private elRef = inject(ElementRef);

  isSticky: boolean = false;
  activeSection: string;
  // The welcome section has its own assistant call to action, and the floating button must not
  // cover the contact form, so it only shows while these sections are active.
  readonly launcherSections = ["about", "experience", "posts"];

  pageYOffset: number = 0;
  pageXOffset: number;

  private stopKeepingFragmentInView?: () => void;

  constructor() {
    this.checkResize();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.keepFragmentInView());
    this.destroyRef.onDestroy(() => this.stopKeepingFragmentInView?.());
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

  /*
   * The router scrolls to a #fragment as soon as the route renders, but the experience and posts
   * sections grow once their data arrives, which pushes later sections (e.g. #contact) out of view.
   * Re-align the target while the page settles, until the visitor scrolls on their own.
  */
  private keepFragmentInView(): void {
    this.stopKeepingFragmentInView?.();
    const fragment = this.router.parseUrl(this.router.url).fragment;
    const target = fragment ? document.getElementById(fragment) : null;
    if (!target || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => target.scrollIntoView({ block: "start", behavior: "instant" }));
    const userEvents = ["wheel", "touchstart", "keydown", "mousedown"];
    const stop = () => {
      observer.disconnect();
      clearTimeout(timeout);
      userEvents.forEach(type => window.removeEventListener(type, stop));
      this.stopKeepingFragmentInView = undefined;
    };
    const timeout = setTimeout(stop, FRAGMENT_SETTLE_TIME);
    userEvents.forEach(type => window.addEventListener(type, stop, { passive: true }));
    // Observe the sections themselves: body has a fixed (viewport) height, so it never resizes.
    this.elRef.nativeElement.querySelectorAll("section").forEach((section: Element) => observer.observe(section));
    this.stopKeepingFragmentInView = stop;
  }
}
