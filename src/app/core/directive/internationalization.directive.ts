import { Directive, ElementRef, Input, OnInit} from '@angular/core';
import { LOCALE_ID, Inject } from '@angular/core';
import { EllipsisPipe } from '../pipe/ellipsis.pipe';

@Directive({ selector: '[internationalization]' })
export class InternationalizationDirective implements OnInit{

    private _data: any[] = [];

    @Input() property :string;
    
    @Input() get data(): any[] {
        return this._data;
    }

    @Input() ellipsis :number;

    constructor(
        private el: ElementRef,
        @Inject(LOCALE_ID) public locale: string
    ) {}

    set data(value: any[]) {
        if(value) {
            this._data = value;
            this.el.nativeElement.innerHTML = this.retrievePropertyValueByLocation();
        }
    }

    ngOnInit(): void {}

    private retrievePropertyValueByLocation(): any {
        
        if(this._data) {

            const value: string[] = this._data
                .filter(element => element.language === (this.locale || 'en'))
                .map(element => element[this.property]) || [''];

            return this.ellipsis > 0 ? new EllipsisPipe().transform(value[0], this.ellipsis) : value;

        }
    }
}