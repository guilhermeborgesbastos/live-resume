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
  styleUrls: ['./experience.component.scss', 'experience-component.reponsivity.scss']
})
export class ExperienceComponent implements OnInit {
  
  SELECTED_CLASS: string = 'selected';
  LEAVE_RIGHT_CLASS: string = 'leave-right';
  ENTER_RIGHT_CLASS: string = 'enter-right';
  LEAVE_LEFT_CLASS: string = 'leave-left';
  ENTER_LEFT_CLASS: string = 'enter-left';
  TRANSITION_TIME: number = 400;

  experiences: IExperience[];
  experiencesOrdered: IExperience[] = [];
  currentPosition: number;
  backgroundUrl: string;

  previousYear: string;
  currentYear: string;
  nextYear: string;

  @ViewChild('orderedList') orderedList: ElementRef;

  constructor(
    private dataService: DataService,
    private sortService: SorterService,
    private renderer: Renderer2,
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
          this.updateMobileNavigationView();
          this.preloadBounderyImages(experiences.map(xp => xp.backgroundUrl));
        });
  }

  // Preloads the boundaries images related to the current position in order to avoid the 'blinking' of the background while navigating.
  private preloadBounderyImages(images: string[]) {
    images.forEach(function (image, i) {
      const preloadImages = new Array();
      preloadImages[i] = new Image();
      preloadImages[i].src = image;
    });
  }

  private createListSelector(position: number): string {
    return `li[id="${position}"]`;
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
