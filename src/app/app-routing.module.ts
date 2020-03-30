import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Any URL apart from the root domain is going to be rendered as 'page-not-found'.
const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/'},
  { path: '**', pathMatch: 'full', redirectTo: '/page-not-found' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }
