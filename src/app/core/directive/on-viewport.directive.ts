import { Directive, OnInit, ElementRef, Output, EventEmitter, Input, OnChanges, inject } from "@angular/core";

export interface InViewportEvent {
    target: HTMLElement;
    value: boolean;
}

@Directive({ selector: "[appInViewport]" })

export class InViewportDirective implements OnChanges {
    private _el = inject(ElementRef);


    @Input() pageYOffset: number;
    @Output() inViewport:EventEmitter<InViewportEvent>;

    constructor() {
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
        // The band near the top of the viewport that decides the active section; on short
        // viewports (e.g. a phone in landscape) it keeps 30% of the height instead of vanishing.
        const bandEnd = Math.max(vp.height - sectionMarging, vp.height * 0.3);
        const tViz = rec.top >= 0 && rec.top < bandEnd;
        const bViz = rec.bottom > 0 && rec.bottom <= bandEnd;
        // A section taller than the band covers it while neither of its edges is inside it.
        const spansBand = rec.top < 0 && rec.bottom > bandEnd;

        const vVisible = partial ? tViz || bViz || spansBand : tViz && bViz;

        const event: InViewportEvent = {
            target: el,
            value: !!(elSize && vVisible)
        };

        if(event.value) {
            this.inViewport.emit(event);
        }
    }
}
