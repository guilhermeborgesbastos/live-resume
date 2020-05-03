import { Component, OnInit, HostListener, AfterViewInit } from '@angular/core';
import { debounce } from '../core/utils';

@Component({
  selector: 'app-resume',
  templateUrl: './resume.component.html',
  styleUrls: ['./resume.component.css', './resume.component.responsivity.css']
})
export class ResumeComponent implements OnInit {

  isSticky: boolean = false;
  activeSection: string;

  pageYOffset: number = 0;
  pageXOffset: number;

  constructor() {
    this.checkResize();
  }

  @HostListener('window:scroll', ['$event'])
  @debounce() 
  checkScroll() {
    this.pageYOffset = window.pageYOffset;
    this.isSticky = pageYOffset >= 250;
  }

  @HostListener('window:resize', ['$event'])
  @debounce(25) 
  checkResize() {
    this.pageXOffset = window.innerWidth;
  }

  ngOnInit(): void { }

  @debounce()
  onViewport(isOnViewPort: any, element?: string) {
    this.activeSection = element;
  }
}
