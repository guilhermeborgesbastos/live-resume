import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { PageNotFoundComponent } from "./page-not-found.component";

const routes: Routes = [
  {
    path: "page-not-found",
    loadComponent: () => import("./page-not-found.component").then(m => m.PageNotFoundComponent)
  }
];

@NgModule({
    imports: [ RouterModule.forChild(routes) ],
    exports: [ RouterModule ]
})

export class PageNotFoundRoutingModule {}