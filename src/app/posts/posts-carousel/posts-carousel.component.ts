import { Component, OnInit, Input } from '@angular/core';
import { IPost } from '../posts-interfaces';

@Component({
  selector: 'app-posts-carousel',
  templateUrl: './posts-carousel.component.html',
  styleUrls: ['./posts-carousel.component.scss', './posts-carousel.component.responsivity.scss']
})

export class PostsCarouselComponent implements OnInit {
  
    MOVE_NEXT_CLASS: string = 'move-next';
    MOVE_PREVIOUS_CLASS: string = 'move-previous';
    TRANSITION_TIME: number = 400;
    
    public _posts: IPost[] = [];
    public _currentPosition: number;

    value: string = '-100%';

    constructor() { }

    @Input() get currentPosition(): number {
        return this._currentPosition;
    }
    
    set currentPosition(value: number) {
        if(value) {
            this._currentPosition = value;
            //this.updateTimelineNavigation();
        }
    }

    @Input() get posts(): IPost[] {
        return this._posts;
    }
  
    set posts(value: IPost[]) {
        if(value) {
          this._posts = value;
          this._posts.sort((a:any, b:any) => +new Date(a.date) - +new Date (b.date));
        }
    }

    ngOnInit(): void {
        
    }
}