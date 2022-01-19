import {
    Directive, OnInit,
    ElementRef, Input, Inject, LOCALE_ID
} from "@angular/core";
import { Typed } from "./typed";

interface IPhrase {
    language: string;
    phrases: string[];
}

@Directive({
    selector: "[appTypingAnimation]"
})

export class TypingAnimationDirective implements OnInit {

    @Input() phrasePeriod: number;
    @Input() typeSpeed: number;
    @Input() startDelay: number;
    @Input() data: IPhrase[];

    typed: Typed;
    phrases: string[] = [];

    constructor (
        private elRef: ElementRef,
        @Inject(LOCALE_ID) public locale: string
    ) {}

    _flatMap = (f, xs) => xs.reduce((acc,x) => acc.concat(f(x)), []);

    ngOnInit () {

        const nestedArr: IPhrase[] = this.data.filter(el => el.language === (this.locale || "en"));
        this.phrases = this._flatMap(el => el.phrases, nestedArr);

        if(this.checkContent()) {
            this.createTyped();
        }
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
        );

        this.typed.begin();
    }
}
