import { NgModule } from '@angular/core';
import { ResumeComponent } from '../resume/resume.component';
import { ResumeRoutingModule } from './resume-routing.module';
import { HeaderComponent } from '../header/header.component';
import { AboutComponent } from '../about/about.component';
import { ContactComponent } from '../contact/contact.component';
import { PostsComponent } from '../posts/posts.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { WelcomeModule } from '../welcome/welcome.molule';
import { ExperienceModule } from '../experience/experience.module';

@NgModule({
  imports: [ 
    ResumeRoutingModule,
    FontAwesomeModule,
    WelcomeModule,
    ExperienceModule
  ],
  declarations: [ 
    ResumeComponent,
    HeaderComponent,
    AboutComponent,
    PostsComponent,
    ContactComponent
  ],
  exports: [ResumeComponent ]
})

export class ResumeModule { }
