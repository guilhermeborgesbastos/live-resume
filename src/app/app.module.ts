import { BrowserModule } from '@angular/platform-browser';
import { NgModule, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ResumeModule } from './resume/resume.module';
import { PageNotFoundRoutingModule } from './404/page-not-found-routing.module';
import { PageNotFoundModule } from './404/page-not-found.module';
import { CoreModule } from './core/core.module';

import localeEn from '@angular/common/locales/en';
import localePt from '@angular/common/locales/pt';
import localePtExtra from '@angular/common/locales/extra/pt';

registerLocaleData(localeEn, 'en');
registerLocaleData(localePt, 'pt-BR', localePtExtra);
@NgModule({
  imports: [ 
    BrowserModule,
    AppRoutingModule,
    CoreModule,
    ResumeModule,
    PageNotFoundModule,
    PageNotFoundRoutingModule
  ],
  declarations: [ AppComponent ],
  bootstrap: [ AppComponent ]
})

export class AppModule {}