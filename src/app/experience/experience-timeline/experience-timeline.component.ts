import { Component, OnInit, Input, ElementRef, ViewChild, EventEmitter, Renderer2, OnDestroy, Output } from '@angular/core';
import { IExperience } from '../experience-interfaces';

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

  // For the purpose of stringifying MM-DD-YYYY date format
  private MONTHS_STR: string[] = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

  @ViewChild('line', { static: false }) line: ElementRef;

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2
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
    const activePreviousElem = this.line.nativeElement.querySelector('.circle.active.current');
    this.renderer.removeClass(activePreviousElem, 'current');
    
    const targetElem = this.line.nativeElement.querySelector('div[id-position="' + this.currentPosition + '"]');
    this.renderer.addClass(targetElem, 'current');
  }

  // TO-DO: not working properly on Firefox
  daysBetween(startDate: string, endDate: string): number {
    return Math.round(Math.abs((+new Date(startDate)) - (+new Date(endDate)))/8.64e7);
  }

  populateExperienceTimeline(): void {

    let dates: string[] = this._experiences.map(experience => experience.startAt);

    // TO-DO: Adding the current day in order to complete the timeline...
    dates.push('02-22-2021');

    if(dates && dates.length < 2) {
      this.renderer.setStyle(this.elRef.nativeElement, 'visibility', 'hidden');
    } 
    else if (dates.length >= 2) {
      const daysBetween: number = this.daysBetween(dates[0], dates[dates.length - 1]);
      const oneDayInPixels: number = this.offsetWidth / daysBetween;
      
      // Draw first date circle      
      this.renderer.appendChild(this.line.nativeElement, this.createCircle(1, 0, dates[0]));

      let i: number;
      const lastFrameLoop = dates.length - 1;

      // Draw the middle date circles
      for (i = 1; i < lastFrameLoop; i++) {
        const periodInDays: number = this.daysBetween(dates[0], dates[i]);
        const periodWidth: number = periodInDays * oneDayInPixels;
        const circleElement = this.createCircle((i + 1), periodWidth, dates[i]);

        if(i == lastFrameLoop - 1) {
          this.renderer.addClass(circleElement, 'current');
        }

        this.renderer.appendChild(this.line.nativeElement, circleElement);        
      }

      // Draw last date circle ( the current frame )
      const lastDataCircle = this.createCurrentTriangle(i + 1);
      this.renderer.appendChild(this.line.nativeElement, lastDataCircle);
    }
  }

  calculatePosition(leftPosition: number, offsetWidth: number) : number {
    return (leftPosition * 100) / offsetWidth;
  }

  // TO-DO: Replace 'circle' for the 'milestone', for meaningful purposes...
  createCircle(index: number, left: number, date: string): any {
    const circleElement = this.renderer.createElement('div');
    this.renderer.addClass(circleElement, 'circle');
    this.renderer.addClass(circleElement, 'active');
    const leftPos = this.calculatePosition(left, this.offsetWidth);
    this.renderer.setStyle(circleElement, 'left', `${leftPos}%`);
    this.renderer.setAttribute(circleElement, 'id-position', index.toString());

    const labelElement = this.createLabelElement(date.toString());

    this.renderer.appendChild(circleElement, labelElement);

    return circleElement;
  }

  createCurrentTriangle(index: number): any {
    const circleElement = this.renderer.createElement('div');
    this.renderer.addClass(circleElement, 'circle');
    this.renderer.addClass(circleElement, 'active');
    this.renderer.addClass(circleElement, 'future');
    this.renderer.setStyle(circleElement, 'left', '100%');
    return circleElement;
  }

  /*
   * Update this function based on the desired date label formatting.
  */
  createLabelElement(date: string): string {
    let month: any = date.split('-')[0];
    month = this.MONTHS_STR[month - 1];
    const labelElement = this.renderer.createElement('div');
    this.renderer.addClass(labelElement, 'popupSpan');

    const monthSpan = this.renderer.createElement('span');
    this.renderer.addClass(monthSpan, 'month');
    this.renderer.appendChild(monthSpan, this.renderer.createText(month));

    const year = date.split('-')[2];
    const yearSpan = this.renderer.createElement('span');
    this.renderer.addClass(yearSpan, 'year');
    this.renderer.appendChild(yearSpan, this.renderer.createText(year));

    this.renderer.appendChild(labelElement, monthSpan);
    this.renderer.appendChild(labelElement, yearSpan);

    return labelElement; // year, E.g: May. 2020
  }
}