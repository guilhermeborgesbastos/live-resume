import { Component, OnInit, Renderer2, ElementRef } from '@angular/core';
import { DataService } from '../core/data.service';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';

@Component({
  selector: 'app-posts',
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss', './posts.component responsivity.scss']
})
export class PostsComponent implements OnInit {

  currentPosition: number = 0;
  posts: any[] = [];
  
  constructor(
    private dataService: DataService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private library: FaIconLibrary
  ) {
    library.addIconPacks(fas, fab);
  }

  ngOnInit(): void {
  }

  onClickPrevious() {

  }

  onClickNext() {

  }
}
