import { Component, OnInit, ElementRef, Renderer2, ViewChild, inject, DestroyRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { EXPERIENCE_QUERY_PARAM } from "../assistant/ui/citations";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { IExperience } from "./experience-interfaces";
import { DataService } from "../core/data.service";
import { SorterService } from "../core/sorter.service";
import { FaIconLibrary, FaIconComponent } from "@fortawesome/angular-fontawesome";
import { AbstractSwipeSection } from "../core/shared/abstract.swipe.section";
import { NgClass } from "@angular/common";
import { InternationalizationDirective } from "../core/directive/internationalization.directive";
import { ExperienceTimelineComponent } from "./experience-timeline/experience-timeline.component";
import { SafariDateFormatterPipe } from "../core/pipe/safari-date-formatter.pipe";
import { LocalizedDatePipe } from "../core/pipe/localized-date.pipe";

@Component({
    selector: "app-experience",
    templateUrl: "./experience.component.html",
    styleUrls: ["./experience.component.scss", "experience-component.reponsivity.scss"],
    imports: [NgClass, FaIconComponent, InternationalizationDirective, ExperienceTimelineComponent, SafariDateFormatterPipe, LocalizedDatePipe]
})
export class ExperienceComponent extends AbstractSwipeSection implements OnInit {
  private dataService = inject(DataService);
  private sortService = inject(SorterService);
  private renderer = inject(Renderer2);
  private library = inject(FaIconLibrary);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private elRef = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  private requestedExperienceId: string | null = null;

  SELECTED_CLASS: string = "selected";
  LEAVE_RIGHT_CLASS: string = "leave-right";
  ENTER_RIGHT_CLASS: string = "enter-right";
  LEAVE_LEFT_CLASS: string = "leave-left";
  ENTER_LEFT_CLASS: string = "enter-left";
  TRANSITION_TIME: number = 400;

  experiences: IExperience[];
  experiencesOrdered: IExperience[] = [];
  currentPosition: number;
  backgroundUrl: string;

  previousYear: string;
  currentYear: string;
  nextYear: string;

  @ViewChild("orderedList") orderedList: ElementRef;

  constructor() {
    super();
    this.library.addIconPacks(fas, fab);
  }

  ngOnInit(): void {

    // Fetch the Experiences from the Data Service
    this.dataService.getExperiences()
        .subscribe((experiences: IExperience[]) => {
          this.currentPosition = experiences.length;
          this.experiences = experiences;

          this.experiencesOrdered = [...experiences];
          this.experiencesOrdered.sort(this.sortService.sort("position", "desc"));       
          this.backgroundUrl = this.retrieveBackgroundUrl();
          this.updateMobileNavigationView();
          this.preloadBounderyImages(experiences.map(xp => xp.backgroundUrl));
          this.revealRequestedExperience();
        });

    // A CV assistant citation links here with ?experienceId=<id>#experience. Every navigation
    // (including following the same citation again, and back/forward) re-reads it.
    this.requestedExperienceId = this.route.snapshot.queryParamMap.get(EXPERIENCE_QUERY_PARAM);
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.requestedExperienceId = this.route.snapshot.queryParamMap.get(EXPERIENCE_QUERY_PARAM);
        this.revealRequestedExperience();
      });
  }

  /*
   * Selects the requested experience once the data is loaded. The ID is looked up in the data
   * (it is neither an array index nor a position); an unknown ID leaves the carousel as it is.
  */
  private revealRequestedExperience(): void {
    const requested = this.requestedExperienceId;
    if (!this.experiences || requested === null || !/^\d+$/.test(requested)) {
      return;
    }
    this.requestedExperienceId = null;
    const experience = this.experiences.find(exp => exp.id === Number(requested));
    if (!experience) {
      return;
    }
    // Wait for the carousel items to render.
    setTimeout(() => {
      this.updateNavigation(experience.position);
      const section = this.elRef.nativeElement.querySelector("section#experience") as HTMLElement | null;
      section?.scrollIntoView({ block: "start" });
      const companyName = this.orderedList.nativeElement
        .querySelector(`${this.createListSelector(experience.position)} .company-name`) as HTMLElement | null;
      companyName?.focus({ preventScroll: true });
    });
  }

  public disablePreviousNavigation(): boolean {
    return this.currentPosition === 1;
  }

  public disableNextNavigation(): boolean {
    return this.currentPosition === this.experiencesOrdered?.length;
  } 

  // Preloads the boundaries images related to the current position in order to avoid the "blinking" of the background while navigating.
  private preloadBounderyImages(images: string[]) {
    images.forEach(function (image, i) {
      const preloadImages = new Array();
      preloadImages[i] = new Image();
      preloadImages[i].src = image;
    });
  }

  private createListSelector(position: number): string {
    return `li[data-position="${position}"]`;
  }

  onClickPrevious(targetPos?: number): void {
    const currElem = this.orderedList.nativeElement.querySelector(this.createListSelector(this.currentPosition));
    this.renderer.removeClass(currElem, this.SELECTED_CLASS);
    this.renderer.addClass(currElem, this.LEAVE_RIGHT_CLASS);

    setTimeout(() => {
      this.renderer.removeClass(currElem, this.LEAVE_RIGHT_CLASS);
    }, this.TRANSITION_TIME);
    
    // Subtracts one to the current position in order to move backwards in the timeline.
    this.currentPosition = (targetPos ? +targetPos : this.currentPosition - 1);
    this.backgroundUrl = this.retrieveBackgroundUrl();
    
    const targetElem = this.orderedList.nativeElement.querySelector(this.createListSelector(this.currentPosition));
    this.renderer.addClass(targetElem, this.SELECTED_CLASS);
    this.renderer.addClass(targetElem, this.ENTER_LEFT_CLASS);

    setTimeout(() => {
      this.renderer.removeClass(targetElem, this.ENTER_LEFT_CLASS);
    }, this.TRANSITION_TIME);

    this.updateMobileNavigationView();
  }

  onClickNext(targetPos?: number): void {
    const currElem = this.orderedList.nativeElement.querySelector(this.createListSelector(this.currentPosition));
    this.renderer.removeClass(currElem, this.SELECTED_CLASS);
    this.renderer.addClass(currElem, this.LEAVE_LEFT_CLASS);

    setTimeout(() => {
      this.renderer.removeClass(currElem, this.LEAVE_LEFT_CLASS);
    }, this.TRANSITION_TIME);
    
    // Sums one to the current position in order to move further in the timeline.
    this.currentPosition = (targetPos ? +targetPos : this.currentPosition + 1);
    this.backgroundUrl = this.retrieveBackgroundUrl();

    const targetElem = this.orderedList.nativeElement.querySelector(this.createListSelector(this.currentPosition));
    this.renderer.addClass(targetElem, this.SELECTED_CLASS);
    this.renderer.addClass(targetElem, this.ENTER_RIGHT_CLASS);

    setTimeout(() => {
      this.renderer.removeClass(targetElem, this.ENTER_RIGHT_CLASS);
    }, this.TRANSITION_TIME);
    
    this.updateMobileNavigationView();
  }

  updateNavigation(targetPos: number) {
    // in case of == nothing to do here
    if(targetPos > this.currentPosition) {
      this.onClickNext(targetPos);
    } else if (targetPos < this.currentPosition) {
      this.onClickPrevious(targetPos);
    }
  }

  private retrieveBackgroundUrl(): string {
    return this.experiences[this.currentPosition - 1].backgroundUrl;
  }

  private updateMobileNavigationView() {
    this.previousYear = 
      this.experiences[this.currentPosition - 2]?.startAt || this.experiences[this.currentPosition - 1].startAt;
    this.currentYear = 
      this.experiences[this.currentPosition - 1].startAt;
    this.nextYear = 
      this.experiences[this.currentPosition]?.startAt || this.experiences[this.currentPosition - 1].startAt;
  }
}
