import { Component, OnInit, Input, ViewChild, ElementRef, Renderer2, LOCALE_ID, AfterViewInit, inject } from "@angular/core";
import { faBars, faShareAlt, faCloudDownloadAlt, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { Router, RouterLink } from "@angular/router";

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

    
  private _activeSection: any;
  private _pageXOffset: any;
  
  hasMenuToggled: boolean;
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
  }

  ngOnInit(): void {
    this.faBars = faBars;
    this.faShareAlt = faShareAlt;
    this.faCloudDownloadAlt = faCloudDownloadAlt;
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