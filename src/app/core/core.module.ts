import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { DataService } from './data.service';
import { SorterService } from './sorter.service';
import { SafariDateFormatterPipe } from './pipe/safari-date-formatter.pipe';
import { LocalizedDatePipe } from './pipe/localized-date.pipe';
import { InternationalizationDirective } from './directive/internationalization.directive';
import { InViewportDirective } from './directive/on-viewport.directive';
import { EllipsisPipe } from './pipe/ellipsis.pipe';

@NgModule({
    imports: [ HttpClientModule ],
    declarations: [ SafariDateFormatterPipe, LocalizedDatePipe, EllipsisPipe, InternationalizationDirective, InViewportDirective],
    providers: [ DataService, SorterService ],
    exports: [ SafariDateFormatterPipe, LocalizedDatePipe, EllipsisPipe, InternationalizationDirective, InViewportDirective ]
})

export class CoreModule { }