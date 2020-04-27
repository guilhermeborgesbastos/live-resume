import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { DataService } from './data.service';
import { SorterService } from './sorter.service';
import { SafariDateFormatterPipe } from './pipe/safari-date-formatter.pipe';
import { LocalizedDatePipe } from './pipe/localized-date.pipe';
import { InternationalizationDirective } from './directive/internationalization.directive';

@NgModule({
    imports: [ HttpClientModule ],
    declarations: [ SafariDateFormatterPipe, LocalizedDatePipe, InternationalizationDirective],
    providers: [ DataService, SorterService ],
    exports: [ SafariDateFormatterPipe, LocalizedDatePipe, InternationalizationDirective ]
})

export class CoreModule { }