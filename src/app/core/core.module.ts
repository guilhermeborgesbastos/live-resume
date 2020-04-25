import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { DataService } from './data.service';
import { SorterService } from './sorter.service';
import { SafariDateFormatterPipe } from './pipe/safari-date-formatter.pipe';

@NgModule({
    imports: [ HttpClientModule ],
    declarations: [ SafariDateFormatterPipe ],
    providers: [ DataService, SorterService ],
    exports: [ SafariDateFormatterPipe ]
})

export class CoreModule { }