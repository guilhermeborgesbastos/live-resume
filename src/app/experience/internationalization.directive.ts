import { Directive, ElementRef, Input, Renderer2, OnInit} from '@angular/core';
import { LOCALE_ID, Inject } from '@angular/core';
import { IExperienceInternationalization } from './experience-interfaces';

@Directive({ selector: '[internationalization]' })
export class InternationalizationDirective implements OnInit{

    @Input() data :IExperienceInternationalization[];
    @Input() property :string;

    constructor(
       private el: ElementRef, 
       private renderer: Renderer2,
       @Inject(LOCALE_ID) public locale: string
    ) {
        this.data = [];
    }

    ngOnInit(): void {
        this.el.nativeElement.innerHTML = this.retrievePropertyValueByLocation();
    }

    private retrievePropertyValueByLocation(): any {
        return this.data
            .filter(element => element.language === (this.locale || 'en'))
            .map(element => element[this.property]) || '';
    }
}