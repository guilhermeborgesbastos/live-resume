import { Component, OnInit, ElementRef, Renderer2, ViewChild } from '@angular/core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { IExperience } from './experience-interfaces';
import { DataService } from '../core/data.service';
import { SorterService } from '../core/sorter.service';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-experience',
  templateUrl: './experience.component.html',
  styleUrls: ['./experience.component.scss']
})
export class ExperienceComponent implements OnInit {

  experiences: IExperience[];
  experiencesOrdered: IExperience[] = [];
  currentPosition: number;
  backgroundUrl: string;

  @ViewChild('orderedList', { static: false }) orderedList: ElementRef;

  constructor(
    private dataService: DataService,
    private sortService: SorterService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private library: FaIconLibrary
  ) {
    library.addIconPacks(fas, fab);
  }

  ngOnInit(): void {

    // Fetch the Experiences from the Data Service
    this.dataService.getExperiences()
        .subscribe((experiences: IExperience[]) => {
          this.currentPosition = experiences.length;
          this.experiences = experiences;

          this.experiencesOrdered = [...experiences];
          this.experiencesOrdered.sort(this.sortService.sort('position', 'desc'));       
          this.backgroundUrl = this.retrieveBackgroundUrl();
        });
  }

  onClickPrevious(targetPos?: number): void {
    const currElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.removeClass(currElem, 'selected');
    this.renderer.addClass(currElem, 'leave-right');

    setTimeout(() => {
      this.renderer.removeClass(currElem, 'leave-right');
    }, 400);
    
    // Subtracts one to the current position in order to move backwards in the timeline.
    this.currentPosition = (targetPos ? +targetPos : this.currentPosition - 1);
    this.backgroundUrl = this.retrieveBackgroundUrl();
    
    const targetElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.addClass(targetElem, 'selected');
    this.renderer.addClass(targetElem, 'enter-left');

    setTimeout(() => {
      this.renderer.removeClass(targetElem, 'enter-left');
    }, 400);
  }

  onClickNext(targetPos?: number): void {
    const currElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.removeClass(currElem, 'selected');
    this.renderer.addClass(currElem, 'leave-left');

    setTimeout(() => {
      this.renderer.removeClass(currElem, 'leave-left');
    }, 400);
    
    // Sums one to the current position in order to move further in the timeline.
    this.currentPosition = (targetPos ? +targetPos : this.currentPosition + 1);
    this.backgroundUrl = this.retrieveBackgroundUrl();

    const targetElem = this.orderedList.nativeElement.querySelector('li[id="' +this.currentPosition + '"]');
    this.renderer.addClass(targetElem, 'selected');
    this.renderer.addClass(targetElem, 'enter-right');

    setTimeout(() => {
      this.renderer.removeClass(targetElem, 'enter-right');
    }, 400);
  }

  updateNavigation(targetPos: number) {
    // in case of == nothing to do here
    if(targetPos > this.currentPosition) {
      this.onClickNext(targetPos);
    } else if (targetPos < this.currentPosition) {
      this.onClickPrevious(targetPos);
    }
  }

  retrieveBackgroundUrl(): string {
    return this.experiences[this.currentPosition - 1].backgroundUrl;
  }

}
