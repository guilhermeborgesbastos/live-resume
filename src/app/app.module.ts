import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { registerLocaleData } from "@angular/common";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ResumeModule } from "./resume/resume.module";
import { PageNotFoundRoutingModule } from "./404/page-not-found-routing.module";
import { PageNotFoundModule } from "./404/page-not-found.module";
import { CoreModule } from "./core/core.module";
import { Injectable } from "@angular/core";

import localeEn from "@angular/common/locales/en";
import localePt from "@angular/common/locales/pt";
import localePtExtra from "@angular/common/locales/extra/pt";

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from "../environments/environment";

import { HammerModule, HammerGestureConfig, HAMMER_GESTURE_CONFIG } from "@angular/platform-browser";
import { DIRECTION_ALL } from "hammerjs";
import { provideFirestore, getFirestore } from "@angular/fire/firestore";

@Injectable()
export class HammerConfig  extends HammerGestureConfig {
    overrides = <any> {
        swipe: { direction: DIRECTION_ALL },
    };
}

registerLocaleData(localeEn, "en");
registerLocaleData(localePt, "pt-BR", localePtExtra);

@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    CoreModule,
    ResumeModule,
    PageNotFoundModule,
    PageNotFoundRoutingModule,
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore()),
    provideAnalytics(() => getAnalytics()),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()),
    HammerModule
  ],
  declarations: [ AppComponent ],
  bootstrap: [ AppComponent ],
  providers: [
    ScreenTrackingService,
    UserTrackingService,
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: HammerConfig,
    },
  ]
})

export class AppModule {}
