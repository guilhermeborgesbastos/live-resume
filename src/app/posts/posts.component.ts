import { Component, OnInit, inject } from "@angular/core";
import { DataService } from "../core/data.service";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { IPost } from "./posts-interfaces";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { AbstractSwipeSection } from "../core/shared/abstract.swipe.section";
import { NgClass } from "@angular/common";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { PostsCarouselComponent } from "./posts-carousel/posts-carousel.component";

@Component({
    selector: "app-posts",
    templateUrl: "./posts.component.html",
    styleUrls: ["./posts.component.scss", "./posts.component.responsivity.scss"],
    imports: [NgClass, FaIconComponent, PostsCarouselComponent]
})
export class PostsComponent extends AbstractSwipeSection implements OnInit {
  private dataService = inject(DataService);


  currentPage: number = 1;
  resultsPerPage: number;
  // Index of the first post on the page the visitor navigated to. Resizing changes how many cards
  // fit per page; the page is recomputed from this index so the same posts stay on screen.
  private firstPostIndex = 0;
  posts: IPost[] = [];
  
  faChevronLeft: IconDefinition;
  faChevronRight: IconDefinition;

  constructor() {
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
    this.goToPage(this.currentPage - 1);
  }

  public onClickNext() {
    this.goToPage(this.currentPage + 1);
  }

  public updateNavigation(resultsPerPage: number) {
    // The carousel fits more or fewer cards per page as the width changes. Keeping the page number
    // would show different posts, or page past the last one and leave the section empty, so show
    // the page that contains the post the visitor navigated to instead.
    if (this.resultsPerPage > 0 && resultsPerPage > 0 && resultsPerPage !== this.resultsPerPage) {
      this.currentPage = Math.floor(this.firstPostIndex / resultsPerPage) + 1;
    }
    this.resultsPerPage = resultsPerPage;
    if (this.lastPage() > 0) {
      this.currentPage = Math.min(this.currentPage, this.lastPage());
    }
  }

  public disablePreviousNavigation(): boolean {
    return this.currentPage <= 1;
  }

  public disableNextNavigation(): boolean {
    return this.currentPage >= this.lastPage();
  }

  private goToPage(page: number): void {
    this.currentPage = page;
    this.firstPostIndex = (page - 1) * this.resultsPerPage;
  }

  // 0 until both the posts and the cards per page are known.
  private lastPage(): number {
    return this.resultsPerPage > 0 ? Math.ceil((this.posts?.length ?? 0) / this.resultsPerPage) : 0;
  }
}