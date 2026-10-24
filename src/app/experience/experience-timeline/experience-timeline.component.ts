import { Component, OnInit, Input, ElementRef, ViewChild, EventEmitter, Renderer2, OnDestroy, Output, LOCALE_ID, inject } from "@angular/core";
import { IExperience } from "../experience-interfaces";
import { SafariDateFormatterPipe } from "../../core/pipe/safari-date-formatter.pipe";
import { LocalizedDatePipe } from "../../core/pipe/localized-date.pipe";

@Component({
    selector: "app-experience-timeline",
    templateUrl: "./experience-timeline.component.html",
    styleUrls: ["./experience-timeline.component.scss", "experience-timeline.component.reponsivity.scss"]
})
export class ExperienceTimelineComponent implements OnInit, OnDestroy {
  private elRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  locale = inject(LOCALE_ID);
  // Created here (an injection context) because the pipe resolves LOCALE_ID itself.
  private localizedDatePipe = new LocalizedDatePipe();


  private _experiences: IExperience[] = [];
  private _currentPosition: number;
  private offsetWidth: number;

  @Output() timelineChanged = new EventEmitter<number>();

  public removeEventListener: () => void;
  private removeResizeListener: () => void;
  private spacingFrame: number;
  // Date milestones with their position on the line (in %) proportional to their date.
  private milestones: { element: HTMLElement, datePosition: number }[] = [];

  @ViewChild("line") line: ElementRef;

  @Input() get currentPosition(): number {
    return this._currentPosition;
  }

  set currentPosition(value: number) {
    if(value) {
      this._currentPosition = value;
      this.updateTimelineNavigation();
    }
  }

  @Input() get experiences(): IExperience[] {
      return this._experiences;
  }

  set experiences(value: IExperience[]) {
      if(value) {
        this._experiences = value;
        this.populateExperienceTimeline();
      }
  }

  ngOnInit() : void {
    this.offsetWidth = this.elRef.nativeElement.offsetWidth;

    this.removeEventListener = this.renderer.listen(this.elRef.nativeElement, "click", (event) => {
      if (event.target && event.target.getAttribute("id-position")) {
        const targetId: number = event.target.getAttribute("id-position");
        this.timelineChanged.emit(targetId);
      }
    });

    // Milestones are placed in percentages but labels have a fixed width, so the spacing depends on the line width.
    this.removeResizeListener = this.renderer.listen("window", "resize", () => this.scheduleMilestoneSpacing());
    // Label widths change once the web font replaces the fallback one.
    document.fonts?.ready.then(() => this.scheduleMilestoneSpacing());
  }

  // Cleanup by removing the event listener on destroy
  public ngOnDestroy() {
    this.removeEventListener();
    this.removeResizeListener();
    cancelAnimationFrame(this.spacingFrame);
  }

  updateTimelineNavigation() {
    const activePreviousElem = this.line.nativeElement.querySelector(".milestone.active.current");
    this.renderer.removeClass(activePreviousElem, "current");

    const targetElem = this.line.nativeElement.querySelector(`div[id-position="${this.currentPosition}"]`);
    this.renderer.addClass(targetElem, "current");
  }

  private scheduleMilestoneSpacing(): void {
    cancelAnimationFrame(this.spacingFrame);
    this.spacingFrame = requestAnimationFrame(() => this.spaceMilestones());
  }

  // Keeps milestones whose dates are close (e.g. Jan 2017 and Dec 2017) at least one label
  // width apart so their date labels do not overlap. The widest label (the current one, with
  // its bigger font) sets the spacing, so the layout holds whichever milestone is selected.
  // Milestones far enough apart stay at their date position.
  private spaceMilestones(): void {
    const lineWidth: number = this.line.nativeElement.offsetWidth;
    if (!lineWidth || !this.milestones.length) {
      return; // Hidden (e.g. on narrow screens): spaced again on the next resize.
    }
    const labelWidths = this.milestones.map(({ element }) => element.querySelector(".popupSpan")!.getBoundingClientRect().width);
    const minSpacing = Math.max(...labelWidths);
    // Uses at most 95% instead of 100% in order to avoid collision to the arrow icon on the right side of the timeline.
    const maxLeft = lineWidth * 0.95;

    // Push milestones right of their date when they are too close to the previous one...
    const lefts = this.milestones.map(({ datePosition }) => Math.min(maxLeft, datePosition * lineWidth / 100));
    for (let i = 1; i < lefts.length; i++) {
      lefts[i] = Math.max(lefts[i], lefts[i - 1] + minSpacing);
    }
    // ...and back left when that pushed them past the end of the line.
    lefts[lefts.length - 1] = Math.min(lefts[lefts.length - 1], maxLeft);
    for (let i = lefts.length - 2; i >= 0; i--) {
      lefts[i] = Math.max(0, Math.min(lefts[i], lefts[i + 1] - minSpacing));
    }

    this.milestones.forEach(({ element }, i) =>
      this.renderer.setStyle(element, "left", `${this.calculatePosition(lefts[i], lineWidth)}%`));
  }

  private daysBetween(startDate: string, endDate: string): number {
    // The .replace() is necessary in order to avoid issues in the Firefox browser.
    const pointA = new Date(startDate.replace(/-/g,'/'));
    const pointB = new Date(endDate.replace(/-/g,'/'));
    return Math.round(Math.abs(+pointA - +pointB) / 8.64e7);
  }

  private retrieveTodayDateAsString(): string {
    const today = new Date();
    return `${today.getMonth()+1}-${today.getDate()}-${today.getFullYear()}`;
  }

  populateExperienceTimeline(): void {

    let dates: string[] = this._experiences.map(experience => experience.startAt);

    // Adding the current day in order to complete the timeline.
    dates.push(this.retrieveTodayDateAsString());

    if(dates && dates.length < 2) {
      this.renderer.setStyle(this.elRef.nativeElement, "visibility", "hidden");
    }
    else if (dates.length >= 2) {
      const daysBetween: number = this.daysBetween(dates[0], dates[dates.length - 1]);
      const oneDayInPixels: number = this.offsetWidth / daysBetween;

      // Draw first date milestone
      this.renderer.appendChild(this.line.nativeElement, this.createMilestone(1, 0, dates[0]));

      let i: number;
      const lastFrameLoop = dates.length - 1;

      // Draw the middle date milestones
      for (i = 1; i < lastFrameLoop; i++) {
        const periodInDays: number = this.daysBetween(dates[0], dates[i]);
        const periodWidth: number = periodInDays * oneDayInPixels;
        const milestoneElement = this.createMilestone((i + 1), periodWidth, dates[i]);

        if(i == lastFrameLoop - 1) {
          this.renderer.addClass(milestoneElement, "current");
        }

        this.renderer.appendChild(this.line.nativeElement, milestoneElement);
      }

      // Draw last date milestone ( the current frame )
      const lastDataMilestone = this.createCurrentTriangle(i + 1);
      this.renderer.appendChild(this.line.nativeElement, lastDataMilestone);

      this.spaceMilestones();
    }
  }

  calculatePosition(leftPosition: number, offsetWidth: number) : number {
    return (leftPosition * 100) / offsetWidth;
  }

  createMilestone(index: number, left: number, date: string): any {
    const milestoneElement = this.renderer.createElement("div");
    this.renderer.addClass(milestoneElement, "milestone");
    this.renderer.addClass(milestoneElement, "active");
    const leftPos = this.calculatePosition(left, this.offsetWidth);
    this.milestones.push({ element: milestoneElement, datePosition: leftPos });
    // Uses at most 95% instead of 100% in order to avoid collision to the arrow icon on the right side of the timeline.
    this.renderer.setStyle(milestoneElement, "left", `${Math.min(95, leftPos)}%`);
    this.renderer.setAttribute(milestoneElement, "id-position", index.toString());

    const labelElement = this.createLabelElement(date.toString());

    this.renderer.appendChild(milestoneElement, labelElement);

    return milestoneElement;
  }

  createCurrentTriangle(index: number): any {
    const milestoneElement = this.renderer.createElement("div");
    this.renderer.addClass(milestoneElement, "milestone");
    this.renderer.addClass(milestoneElement, "active");
    this.renderer.addClass(milestoneElement, "future");
    this.renderer.setStyle(milestoneElement, "left", "100%");
    return milestoneElement;
  }

  // Update this function based on the desired date label formatting.
  createLabelElement(date: string): string {

    const safariDateFormatterPipe = new SafariDateFormatterPipe();
    const safariDateFormatterPipeValue = safariDateFormatterPipe.transform(date);

    let month: any = this.localizedDatePipe.transform(safariDateFormatterPipeValue, "MMM");
    const labelElement = this.renderer.createElement("div");
    this.renderer.addClass(labelElement, "popupSpan");

    const monthSpan = this.renderer.createElement("span");
    this.renderer.addClass(monthSpan, "month");
    this.renderer.appendChild(monthSpan, this.renderer.createText(month));

    const year = this.localizedDatePipe.transform(safariDateFormatterPipeValue, "yyyy");
    const yearSpan = this.renderer.createElement("span");
    this.renderer.addClass(yearSpan, "year");
    this.renderer.appendChild(yearSpan, this.renderer.createText(year));

    this.renderer.appendChild(labelElement, monthSpan);
    this.renderer.appendChild(labelElement, yearSpan);

    return labelElement; // year, E.g: May. 2020
  }
}
