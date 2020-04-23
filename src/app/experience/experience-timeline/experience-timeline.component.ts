import { Component, OnInit, Input, ElementRef, ViewChild, ViewChildren, QueryList, Renderer2 } from '@angular/core';
import { IExperience } from '../experience-interfaces';

@Component({
  selector: 'app-experience-timeline',
  templateUrl: './experience-timeline.component.html',
  styleUrls: [ './experience-timeline.component.scss' ]
})
export class ExperienceTimelineComponent implements OnInit {

  private _experiences: IExperience[] = [];
  private offsetWidth: number;

  // For the purpose of stringifying MM-DD-YYYY date format
  private MONTHS_STR: string[] = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

  @ViewChild('line', { static: false }) line: ElementRef;

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2
  ) {}

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
      this.renderer.appendChild(this.line.nativeElement, this.createCircle(0, 0, dates[0]));

      let i: number;
      const lastFrameLoop = dates.length - 1;

      // Draw the middle date circles
      for (i = 1; i < lastFrameLoop; i++) {
        const periodInDays: number = this.daysBetween(dates[0], dates[i]);
        const periodWidth: number = periodInDays * oneDayInPixels;
        const circleElement = this.createCircle(i, periodWidth, dates[i]);

        if(i == lastFrameLoop - 1) {
          this.renderer.addClass(circleElement, 'current');
        }

        this.renderer.appendChild(this.line.nativeElement, circleElement);        
      }

      // Draw last date circle ( the current frame )
      const lastDataCircle = this.createCurrentCircle(i);
      this.renderer.appendChild(this.line.nativeElement, lastDataCircle);
    }
  }

  calculatePosition(leftPosition: number, offsetWidth: number) : number {
    return (leftPosition * 100) / offsetWidth;
  }

  createCircle(index: number, left: number, date: string): any {
    const circleElement = this.renderer.createElement('div');
    this.renderer.addClass(circleElement, 'circle');
    this.renderer.addClass(circleElement, 'active');
    const leftPos = this.calculatePosition(left, this.offsetWidth);
    this.renderer.setStyle(circleElement, 'left', `${leftPos}%`);
    this.renderer.setAttribute(circleElement, 'id', 'circle_' + index);

    const labelElement = this.renderer.createElement('div');
    this.renderer.addClass(labelElement, 'popupSpan');
    const labelText = this.renderer.createText(this.dateSpan(date.toString()));
    this.renderer.appendChild(labelElement, labelText);

    this.renderer.appendChild(circleElement, labelElement);

    return circleElement;
  }

  createCurrentCircle(index: number): any {
    const circleElement = this.renderer.createElement('div');
    this.renderer.addClass(circleElement, 'circle');
    this.renderer.addClass(circleElement, 'active');
    this.renderer.setStyle(circleElement, 'left', '100%');
    this.renderer.setAttribute(circleElement, 'id', 'circle_' + index);

    const labelElement = this.renderer.createElement('div');
    this.renderer.addClass(labelElement, 'popupSpan');
    const labelText = this.renderer.createText('currently');
    this.renderer.appendChild(labelElement, labelText);

    this.renderer.appendChild(circleElement, labelElement);

    return circleElement;
  }

  /*
   * Update this function based on the desired date formatting.
  */
  dateSpan(date: string): string {
    let month: any = date.split('-')[0];
    month = this.MONTHS_STR[month - 1];
    const year = date.split('-')[2];
    return `${month} ${year}`; // year, E.g: May. 2020
  }
}