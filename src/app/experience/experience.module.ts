import { NgModule } from '@angular/core';
import { ExperienceComponent } from './experience.component';
import { ExperienceTimelineComponent } from './experience-timeline/experience-timeline.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommonModule } from '@angular/common';
import { CoreModule } from '../core/core.module';

@NgModule({
    imports: [ CommonModule, FontAwesomeModule, CoreModule],
    declarations: [ ExperienceComponent, ExperienceTimelineComponent ],
    exports: [ ExperienceComponent ]
})

export class ExperienceModule { }