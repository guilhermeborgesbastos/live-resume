import { Component, OnInit, Input, ViewChild, ElementRef, Renderer2, LOCALE_ID, AfterViewInit, DestroyRef, inject } from "@angular/core";
import { faBars, faShareAlt, faCloudDownloadAlt, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { filter } from "rxjs/operators";

/** localStorage key set once the AI Assistant link has played its first-visit animation. */
const ASSISTANT_INTRO_KEY = "live-resume.assistantIntroSeen";
/** Wait for the page to settle before drawing attention to the link. */
const ASSISTANT_INTRO_DELAY = 1200;
/** Matches the `assistant-intro-pill` animation in header.component.scss. */
const ASSISTANT_INTRO_DURATION = 2600;
/** localStorage key set once the visitor has opened the AI Assistant page (hides the "New" badge). */
const ASSISTANT_VISITED_KEY = "live-resume.assistantVisited";

@Component({
    selector: "app-header",
    templateUrl: "./header.component.html",
    styleUrls: ["./header.component.scss", "./header.component.responsivity.scss"],
    imports: [FaIconComponent, NgClass, RouterLink]
})

export class HeaderComponent implements OnInit, AfterViewInit {
  locale = inject(LOCALE_ID);
  private renderer = inject(Renderer2);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

    
  private _activeSection: any;
  private _pageXOffset: any;
  
  hasMenuToggled: boolean;
  /** The "New" badge on the AI Assistant link, until the visitor has opened the assistant once. */
  showNewBadge = !this.hasFlag(ASSISTANT_VISITED_KEY);
  faBars: IconDefinition;
  faShareAlt: IconDefinition;
  faCloudDownloadAlt: IconDefinition;

  @ViewChild("nav") nav: ElementRef;
  @ViewChild("shareBtn") shareBtn: ElementRef;

  // use getter setter to define the properties
  get activeSection(): any { 
    return this._activeSection;
  }
  
  get pageXOffset(): any { 
    return this._pageXOffset;
  }

  @Input()
  set pageXOffset(value: any) {
    this._pageXOffset = value;
    this.onDetectScreenSize();
  }

  @Input()
  set activeSection(value: any) {
    this._activeSection = value;
    this.updateNavigation();
  }

  ngAfterViewInit() {    
      // Share button available only for browsers that do support it.
      if (typeof navigator.share === "function") {
        this.shareBtn.nativeElement.style.display = "block";
      }
      // The active section may have been set (e.g. statically by the assistant page) before the view existed.
      this.updateNavigation();
      this.introduceAssistantLink();
  }

  /*
   * On a visitor's first visit, briefly highlight the AI Assistant link so it gets noticed. It
   * only plays where the link is on screen (the desktop nav; the collapsed mobile menu hides it)
   * and not on the assistant page itself, and it plays once per browser.
  */
  private introduceAssistantLink() {
    const link: HTMLElement | null = this.nav?.nativeElement.querySelector('a[data-section="assistant"]');
    if (!link || this.hasFlag(ASSISTANT_INTRO_KEY)) {
      return;
    }
    let end: ReturnType<typeof setTimeout> | undefined;
    // Checked when it would play: the menu state follows the viewport width only after startup.
    const start = setTimeout(() => {
      if (link.offsetParent === null || this.isAssistantRoute()) {
        return;
      }
      this.renderer.addClass(link, "assistant-intro");
      this.setFlag(ASSISTANT_INTRO_KEY);
      end = setTimeout(() => this.renderer.removeClass(link, "assistant-intro"), ASSISTANT_INTRO_DURATION);
    }, ASSISTANT_INTRO_DELAY);
    this.destroyRef.onDestroy(() => {
      clearTimeout(start);
      clearTimeout(end);
    });
  }

  private markAssistantVisited() {
    if (this.showNewBadge && this.isAssistantRoute()) {
      this.showNewBadge = false;
      this.setFlag(ASSISTANT_VISITED_KEY);
    }
  }

  private hasFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }

  private setFlag(key: string) {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Storage blocked (e.g. some private windows): the badge or animation may show again next visit.
    }
  }

  ngOnInit(): void {
    this.faBars = faBars;
    this.faShareAlt = faShareAlt;
    this.faCloudDownloadAlt = faCloudDownloadAlt;

    // On the assistant page the router may still report the previous URL while it renders, so
    // also check after each navigation.
    this.markAssistantVisited();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.markAssistantVisited());
  }

  private updateNavigation() {

    if(this._activeSection && this.renderer && this.nav) {
      
      // Remove any selected anchor
      const activePreviousElem = this.nav.nativeElement.querySelector("a.active");
      
      if(activePreviousElem) {
        this.renderer.removeClass(activePreviousElem, "active");
      }

      const targetElem = this.nav.nativeElement.querySelector(`a[data-section="${this._activeSection}"]`);
      if(targetElem) {
        this.renderer.addClass(targetElem, "active");
      }
    }
  }

  /*
   * For media types such as tablets and mobile devices, the nav-bar navigation should be
   * collapsed by default.
  */
  private onDetectScreenSize() {
    this.hasMenuToggled = this.pageXOffset > 1024;
  }

  onToggleBar() {
    this.hasMenuToggled = !this.hasMenuToggled;
  }

  resetMenu() {
    this.hasMenuToggled = this.pageXOffset > 1024;
  }

  /*
   * On the resume the section links are plain #fragment anchors. Elsewhere (the assistant page)
   * they would resolve against the base href and reload the app, so navigate inside the SPA
   * instead, which keeps the assistant conversation.
  */
  onSectionLink(event: MouseEvent, section: string | null) {
    this.resetMenu();
    if (!this.isResumeRoute()) {
      event.preventDefault();
      this.router.navigate(["/"], section ? { fragment: section } : {});
    }
  }

  // The language links load the other locale's build, on the same page.
  localeHref(language: string): string {
    return this.isAssistantRoute() ? `/${language}/assistant` : `/${language}/index.html`;
  }

  private currentPath(): string {
    return this.router.url.split(/[?#]/)[0];
  }

  private isResumeRoute(): boolean {
    return this.currentPath() === "/";
  }

  private isAssistantRoute(): boolean {
    return this.currentPath() === "/assistant";
  }

  async share() {
    try{
      await navigator.share({
        title: "Live Resume - Guilherme Borges Bastos",
        text: "Hello, I'm a Full-stack Java Web Developer with 10+ years of experience designing web and mobile projects. Find out more in my live-resume!",
        url: "https://guilhermeborgesbastos.com"
      });
    } catch(error) {
      console.log("You app is not shared, reason: ", error);
    }    
  }
}