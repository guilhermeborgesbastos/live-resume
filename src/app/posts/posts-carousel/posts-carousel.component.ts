import { Component, OnInit, Input, HostListener, HostBinding, ElementRef, AfterViewInit } from '@angular/core';
import { IPost } from '../posts-interfaces';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
    selector: 'app-posts-carousel',
    templateUrl: './posts-carousel.component.html',
    styleUrls: ['./posts-carousel.component.scss', './posts-carousel.component.responsivity.scss'],
    animations: [
        trigger('fadeInOut', [
            state('void', style({
                opacity: 0
            })),
            transition('void <=> *', animate(300)),
        ])
    ]
})

export class PostsCarouselComponent implements OnInit {
    
    public _posts: IPost[] = [];
    public _originalPosts: IPost[] = [];
    public _currentPage: number;

    resultsPerPage: number;
    elWidth: number;

    constructor(private elRef: ElementRef) { }

    @Input() get currentPage(): number {
        return this._currentPage;
    }
    
    set currentPage(value: number) {
        if(value) {
            this._currentPage = value;
            this.populateCarousel();
        }
    }

    @Input() get posts(): IPost[] {
        return this._posts;
    }
  
    set posts(value: IPost[]) {
        if(value) {
            this._originalPosts = value;
            this.onResizeElement();
        }
    }
    
    ngOnInit(): void {}

    @HostListener('window:resize', ['$event.target']) 
    onResize() { 
        this.onResizeElement();
    }

    private onResizeElement(): void {
        this.elWidth = this.elRef.nativeElement.clientWidth;
        this.resultsPerPage = Math.ceil(this.elWidth / 460);

        this.populateCarousel();
    }

    private populateCarousel(): void {

        if(this._currentPage && this._posts) {
            const start =  (this._currentPage - 1) * this.resultsPerPage;
            const end = this._currentPage * this.resultsPerPage;

            this._posts = this._originalPosts.slice(start, end);
            this._posts.sort((a:any, b:any) => +new Date (b.date) - +new Date(a.date));
        }
    }
}