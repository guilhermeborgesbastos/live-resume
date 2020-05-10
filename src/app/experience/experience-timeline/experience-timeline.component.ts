import { 
  Component, OnInit,
  Input, ElementRef,
  ViewChild, EventEmitter,
  Renderer2, OnDestroy,
  Output, LOCALE_ID,
  Inject
} from '@angular/core';
import { IExperience } from '../experience-interfaces';
import { SafariDateFormatterPipe } from '../../core/pipe/safari-date-formatter.pipe';
import { LocalizedDatePipe } from '../../core/pipe/localized-date.pipe';

@Component({
  selector: 'app-experience-timeline',
  templateUrl: './experience-timeline.component.html',
  styleUrls: [ './experience-timeline.component.scss' , 'experience-timeline.component.reponsivity.scss']
})
export class ExperienceTimelineComponent implements OnInit, OnDestroy {

  private _experiences: IExperience[] = [];
  private _currentPosition: number;
  private offsetWidth: number;

  @Output() onTimelineChanged = new EventEmitter<number>();

  public removeEventListener: () => void;

  @ViewChild('line') line: ElementRef;

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
    @Inject(LOCALE_ID) public locale: string
  ) {}

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

    this.removeEventListener = this.renderer.listen(this.elRef.nativeElement, 'click', (event) => {
      if (event.target && event.target.getAttribute('id-position')) {
        const targetId: number = event.target.getAttribute('id-position');
        this.onTimelineChanged.emit(targetId);
      }
    });
  }

  // Cleanup by removing the event listener on destroy
  public ngOnDestroy() {
    this.removeEventListener();
  }
  
  updateTimelineNavigation() {
    const activePreviousElem = this.line.nativeElement.querySelector('.milestone.active.current');
    this.renderer.removeClass(activePreviousElem, 'current');
    
    const targetElem = this.line.nativeElement.querySelector('div[id-position="' + this.currentPosition + '"]');
    this.renderer.addClass(targetElem, 'current');
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
      this.renderer.setStyle(this.elRef.nativeElement, 'visibility', 'hidden');
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
          this.renderer.addClass(milestoneElement, 'current');
        }

        this.renderer.appendChild(this.line.nativeElement, milestoneElement);        
      }

      // Draw last date milestone ( the current frame )
      const lastDataMilestone = this.createCurrentTriangle(i + 1);
      this.renderer.appendChild(this.line.nativeElement, lastDataMilestone);
    }
  }

  calculatePosition(leftPosition: number, offsetWidth: number) : number {
    return (leftPosition * 100) / offsetWidth;
  }

  createMilestone(index: number, left: number, date: string): any {
    const milestoneElement = this.renderer.createElement('div');
    this.renderer.addClass(milestoneElement, 'milestone');
    this.renderer.addClass(milestoneElement, 'active');
    const leftPos = this.calculatePosition(left, this.offsetWidth);
    // Uses at most 95% instead of 100% in order to avoid collision to the arrow icon on the right side of the timeline.
    this.renderer.setStyle(milestoneElement, 'left', `${Math.min(95, leftPos)}%`);
    this.renderer.setAttribute(milestoneElement, 'id-position', index.toString());

    const labelElement = this.createLabelElement(date.toString());

    this.renderer.appendChild(milestoneElement, labelElement);

    return milestoneElement;
  }

  createCurrentTriangle(index: number): any {
    const milestoneElement = this.renderer.createElement('div');
    this.renderer.addClass(milestoneElement, 'milestone');
    this.renderer.addClass(milestoneElement, 'active');
    this.renderer.addClass(milestoneElement, 'future');
    this.renderer.setStyle(milestoneElement, 'left', '100%');
    return milestoneElement;
  }

  // Update this function based on the desired date label formatting.
  createLabelElement(date: string): string {

    const safariDateFormatterPipe = new SafariDateFormatterPipe();
    const safariDateFormatterPipeValue = safariDateFormatterPipe.transform(date);
    
    const localizedDatePipe = new LocalizedDatePipe(this.locale);

    let month: any = localizedDatePipe.transform(safariDateFormatterPipeValue, 'MMM');
    const labelElement = this.renderer.createElement('div');
    this.renderer.addClass(labelElement, 'popupSpan');

    const monthSpan = this.renderer.createElement('span');
    this.renderer.addClass(monthSpan, 'month');
    this.renderer.appendChild(monthSpan, this.renderer.createText(month));

    const year = localizedDatePipe.transform(safariDateFormatterPipeValue, 'yyyy');
    const yearSpan = this.renderer.createElement('span');
    this.renderer.addClass(yearSpan, 'year');
    this.renderer.appendChild(yearSpan, this.renderer.createText(year));

    this.renderer.appendChild(labelElement, monthSpan);
    this.renderer.appendChild(labelElement, yearSpan);

    return labelElement; // year, E.g: May. 2020
  }
}