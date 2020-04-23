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
  experiencesDesc: IExperience[] = [];
  currentPosition: number;

  @ViewChild('orderedList', { static: false }) orderedList: ElementRef;

  constructor(
    private dataService: DataService,
    private sortService: SorterService,
    private elRef: ElementRef,
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

          this.experiencesDesc = [...experiences];
          this.experiencesDesc.sort(this.sortService.sort('position', 'desc'));        
        });
  }

  onClickPrevious(): void {
    const currElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.removeClass(currElem, 'selected');
    this.renderer.addClass(currElem, 'leave-right');

    setTimeout(() => {
      this.renderer.removeClass(currElem, 'leave-right');
    }, 400);
    
    this.currentPosition = this.currentPosition - 1;

    const targetElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.addClass(targetElem, 'selected');
    this.renderer.addClass(targetElem, 'enter-left');

    setTimeout(() => {
      this.renderer.removeClass(targetElem, 'enter-left');
    }, 400);
  }

  onClickNext(): void{
    const currElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.removeClass(currElem, 'selected');
    this.renderer.addClass(currElem, 'leave-left');

    setTimeout(() => {
      this.renderer.removeClass(currElem, 'leave-left');
    }, 400);
    
    this.currentPosition = this.currentPosition + 1;

    const targetElem = this.orderedList.nativeElement.querySelector('li[id="' + this.currentPosition + '"]');
    this.renderer.addClass(targetElem, 'selected');
    this.renderer.addClass(targetElem, 'enter-right');

    setTimeout(() => {
      this.renderer.removeClass(targetElem, 'enter-right');
    }, 400);
  }

}
