import { 
    Component, OnInit,
    Input, HostListener,
    EventEmitter, ElementRef,
    Output
} from '@angular/core';
import { IPost } from '../posts-interfaces';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { debounce } from '../../core/utils';

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

    @Output() onResultsPerPageChanged = new EventEmitter<number>();

    resultsPerPage: number;
    elWidth: number;
    start: number;
    end: number;

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

    @HostListener('window:resize')
    @debounce(25) 
    onResize() { 
        this.onResizeElement();
    }

    private onResizeElement(): void {
        this.elWidth = this.elRef.nativeElement.clientWidth;
        this.resultsPerPage = Math.ceil(this.elWidth / 465);

        this.populateCarousel();
    }

    private populateCarousel(): void {

        if(this._currentPage && this._posts) {
            this.start =  (this._currentPage - 1) * this.resultsPerPage;
            this.end = this._currentPage * this.resultsPerPage;

            this._posts = this._originalPosts.slice(this.start, this.end);
            this._posts.sort((a:any, b:any) => +new Date (b.date) - +new Date(a.date));

            this.onResultsPerPageChanged.emit(this.resultsPerPage);
        }
    }
}