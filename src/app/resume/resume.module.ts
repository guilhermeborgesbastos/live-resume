import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ResumeComponent } from '../resume/resume.component';
import { ResumeRoutingModule } from './resume-routing.module';
import { HeaderComponent } from '../header/header.component';
import { AboutComponent } from '../about/about.component';
import { ContactComponent } from '../contact/contact.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { WelcomeModule } from '../welcome/welcome.molule';
import { ExperienceModule } from '../experience/experience.module';
import { CoreModule } from '../core/core.module';
import { PostsModule } from '../posts/posts.molule';

@NgModule({
  imports: [
    ReactiveFormsModule,
    CommonModule, 
    CoreModule,
    ResumeRoutingModule,
    FontAwesomeModule,
    WelcomeModule,
    ExperienceModule,
    PostsModule
  ],
  declarations: [ 
    ResumeComponent,
    HeaderComponent,
    AboutComponent,
    ContactComponent
  ],
  exports: [ ResumeComponent ]
})

export class ResumeModule { }
