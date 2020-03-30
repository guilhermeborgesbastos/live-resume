import { NgModule } from '@angular/core';
import { PageNotFoundRoutingModule } from './page-not-found-routing.module';
import { PageNotFoundComponent } from './page-not-found.component';

@NgModule({
    imports: [ PageNotFoundRoutingModule ],
    declarations: [ PageNotFoundComponent ],
    exports: [ PageNotFoundComponent ]
})

export class PageNotFoundModule {}