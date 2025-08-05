import { NgModule } from "@angular/core";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

import { DataService } from "./data.service";
import { SorterService } from "./sorter.service";
import { SafariDateFormatterPipe } from "./pipe/safari-date-formatter.pipe";
import { LocalizedDatePipe } from "./pipe/localized-date.pipe";
import { InternationalizationDirective } from "./directive/internationalization.directive";
import { InViewportDirective } from "./directive/on-viewport.directive";
import { EllipsisPipe } from "./pipe/ellipsis.pipe";

@NgModule({ declarations: [SafariDateFormatterPipe, LocalizedDatePipe, EllipsisPipe, InternationalizationDirective, InViewportDirective],
    exports: [SafariDateFormatterPipe, LocalizedDatePipe, EllipsisPipe, InternationalizationDirective, InViewportDirective], imports: [], providers: [DataService, SorterService, provideHttpClient(withInterceptorsFromDi())] })

export class CoreModule { }