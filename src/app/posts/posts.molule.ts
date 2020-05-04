import { NgModule } from '@angular/core';
import { PostsComponent } from './posts.component';
import { PostsCarouselComponent } from './posts-carousel/posts-carousel.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { CoreModule } from '../core/core.module';

@NgModule({
    imports: [ CommonModule, FontAwesomeModule, CoreModule],
    declarations: [ PostsComponent, PostsCarouselComponent ],
    exports: [ PostsComponent ]
})

export class PostsModule { }