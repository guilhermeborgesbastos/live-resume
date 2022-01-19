import {
    Directive, OnInit,
    ElementRef, Output,
    EventEmitter, Input,
    OnChanges
} from "@angular/core";

@Directive({
  selector: "[appInViewport]"
})

export class InViewportDirective implements OnChanges {

    @Input() pageYOffset: number;
    @Output() inViewport:EventEmitter<Object>;

    constructor(private _el:ElementRef) {
        this.inViewport = new EventEmitter();
    }

    public ngOnChanges(): void {
        this.check();
    }

    check(partial:boolean = true) {

        const el = this._el.nativeElement;
        const elSize = (el.offsetWidth * el.offsetHeight);

        const rec = el.getBoundingClientRect();

        const vp = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        const sectionMarging = 370;
        const tViz = rec.top >= 0 && rec.top < (vp.height - sectionMarging);
        const bViz = rec.bottom > 0 && rec.bottom <= (vp.height - sectionMarging);

        const vVisible = partial ? tViz || bViz : tViz && bViz;

        let event = {
            target: el,
            value: false
        };

        event["value"] = (elSize && vVisible);

        if(event["value"]) {
            this.inViewport.emit(event);
        }
    }
}
