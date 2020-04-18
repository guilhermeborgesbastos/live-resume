import {
    Directive, OnInit,
    ElementRef, Input
} from '@angular/core';
import { Typed } from './typed';

@Directive({
    selector: '[typingAnimation]'
})

export class TypingAnimationDirective implements OnInit {

    typed: Typed;
    @Input('phrasePeriod') phrasePeriod: number;
    @Input('typeSpeed') typeSpeed: number;
    @Input('startDelay') startDelay: number;
    @Input('phrases') phrases: string[];

    constructor (private elRef: ElementRef) {}

    ngOnInit () {
        if (!this.checkContent()) {
            return;
        }
        this.createTyped();
    }

    private checkContent() {
        return this.phrases.length > 0;
    }

    private createTyped () {
       this.typed = new Typed(
            this.elRef.nativeElement,
            {
                typeSpeed: this.typeSpeed,
                startDelay: this.startDelay,
                phrasePeriod: this.phrasePeriod
            },
            this.phrases
        )
        
        this.typed.begin();
    }
}