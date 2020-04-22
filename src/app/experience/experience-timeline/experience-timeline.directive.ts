import {
    Directive, OnInit,
    ElementRef, Input
} from '@angular/core';
import { Frame } from './experience-timeline-frame/frame';
import { IExperience } from '../experience-interfaces';

@Directive({
    selector: '[experienceTimeline]',
})

export class ExperienceTimelineDirective implements OnInit {

    frame: Frame;
    @Input('className') className: string;
    @Input('dateFormat') dateFormat: string;
    @Input('data') data: IExperience[];

    constructor (private elRef: ElementRef) {}

    ngOnInit () {
        this.createFrame();
    }

    private createFrame () {
       this.frame = new Frame(
            this.elRef.nativeElement,
            {
                className: this.className,
                dateFormat: this.dateFormat
            },
            this.data
        )
        
        this.frame.begin();
    }
}