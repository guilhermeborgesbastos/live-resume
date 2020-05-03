import { Component, OnInit, Renderer2, ElementRef } from '@angular/core';
import { DataService } from '../core/data.service';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { IPost } from './posts-interfaces';
import { SorterService } from '../core/sorter.service';

@Component({
  selector: 'app-posts',
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss', './posts.component responsivity.scss']
})
export class PostsComponent implements OnInit {

  currentPosition: number = 0;
  posts: IPost[] = [];
  postsOrdered: IPost[] = [];
  
  constructor(
    private dataService: DataService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private library: FaIconLibrary,
    private sortService: SorterService,
  ) {
    library.addIconPacks(fas, fab);
  }

  ngOnInit(): void {

      // Fetch the Posts from the Data Service
      this.dataService.getPosts()
      .subscribe((posts: IPost[]) => {
        this.currentPosition = posts.length;
        this.posts = posts;

        this.postsOrdered = [...posts];
        this.postsOrdered.sort((a:any, b:any) => +new Date(a.date) - +new Date (b.date));

        console.log(this.posts);
        console.log(this.postsOrdered);
      });
  }

  onClickPrevious() {

  }

  onClickNext() {

  }
}
