import { Component, OnInit } from "@angular/core";
import { DataService } from "../core/data.service";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { IPost } from "./posts-interfaces";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { AbstractSwipeSection } from "../core/shared/abstract.swipe.section";

@Component({
  selector: "app-posts",
  templateUrl: "./posts.component.html",
  styleUrls: ["./posts.component.scss", "./posts.component.responsivity.scss"]
})
export class PostsComponent extends AbstractSwipeSection implements OnInit {

  currentPage: number = 1;
  resultsPerPage: number;
  posts: IPost[] = [];
  
  faChevronLeft: IconDefinition;
  faChevronRight: IconDefinition;

  constructor(private dataService: DataService) {
    super();
   }

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

  public disablePreviousNavigation(): boolean {
    return this.currentPage === 1;
  }

  public disableNextNavigation(): boolean {
    return this.currentPage === Math.ceil(this.posts?.length / this.resultsPerPage);
  } 
}