import { Directive, OnInit, ElementRef, Input, LOCALE_ID, inject } from "@angular/core";
import { Typed } from "./typed";

interface IPhrase {
    language: string;
    phrases: string[];
}

@Directive({ selector: "[appTypingAnimation]" })

export class TypingAnimationDirective implements OnInit {
    private elRef = inject(ElementRef);
    locale = inject(LOCALE_ID);


    @Input() phrasePeriod: number;
    @Input() typeSpeed: number;
    @Input() startDelay: number;
    @Input() data: IPhrase[];

    typed: Typed;
    phrases: string[] = [];

    _flatMap = (f, xs) => xs.reduce((acc,x) => acc.concat(f(x)), []);

    ngOnInit () {

        const nestedArr: IPhrase[] = this.data.filter(el => el.language === (this.locale || "en"));
        this.phrases = this._flatMap(el => el.phrases, nestedArr);

        if(!this.checkContent()) {
            return;
        }
        // With reduced motion, show the greeting as static text instead of typing it.
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            this.elRef.nativeElement.textContent = this.phrases[0];
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
        );

        this.typed.begin();
    }
}
