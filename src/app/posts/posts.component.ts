import { Component, OnInit, Input } from '@angular/core';
import { DataService } from '../core/data.service';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { IPost } from './posts-interfaces';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-posts',
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss', './posts.component.responsivity.scss']
})
export class PostsComponent implements OnInit {

  currentPage: number = 1;
  resultsPerPage: number;
  posts: IPost[] = [];
  
  faChevronLeft: IconDefinition;
  faChevronRight: IconDefinition;

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    this.faChevronLeft = faChevronLeft;
    this.faChevronRight = faChevronRight;
    
    // Fetch the Posts from the Data Service
    this.dataService.getPosts()
      .subscribe((posts: IPost[]) => {
        this.posts = posts;
      });
  }

  ceil(val: number): number {
    return Math.ceil(val);
  }

  onClickPrevious() {
      this.currentPage--;
  }

  onClickNext() {
      this.currentPage++;
  }

  updateNavigation(resultsPerPage: number) {
    this.resultsPerPage = resultsPerPage;
  }
}