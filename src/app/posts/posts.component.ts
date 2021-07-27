import { Component, OnInit } from "@angular/core";
import { DataService } from "../core/data.service";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { IPost } from "./posts-interfaces";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Direction } from '../experience/experience.component';

@Component({
  selector: "app-posts",
  templateUrl: "./posts.component.html",
  styleUrls: ["./posts.component.scss", "./posts.component.responsivity.scss"]
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

  public onClickPrevious(): void {
    this.currentPage--;
  }

  public onClickNext() {
    this.currentPage++;
  }

  public updateNavigation(resultsPerPage: number) {
    this.resultsPerPage = resultsPerPage;
  }

  public onSwipe(event) {
    const direction: Direction = Math.abs(event.deltaX) > 40 ? (event.deltaX > 0 ? Direction.Right : Direction.Left) : undefined;
    if(!this.disablePreviousNavigation() && direction === Direction.Right) {
      this.onClickPrevious();
    } else if(!this.disableNextNavigation() && direction === Direction.Left) {
      this.onClickNext();
    }
  }

  public disablePreviousNavigation(): boolean {
    return this.currentPage === 1;
  }

  public disableNextNavigation(): boolean {
    return this.currentPage === Math.ceil(this.posts?.length / this.resultsPerPage);
  } 
}