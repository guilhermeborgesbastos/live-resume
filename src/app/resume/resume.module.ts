import { NgModule } from '@angular/core';
import { ResumeComponent } from '../resume/resume.component';
import { ResumeRoutingModule } from './resume-routing.module';
import { HeaderComponent } from '../header/header.component';
import { WelcomeComponent } from '../welcome/welcome.component';
import { AboutComponent } from '../about/about.component';
import { ContactComponent } from '../contact/contact.component';
import { PostsComponent } from '../posts/posts.component';
import { ExperienceComponent } from '../experience/experience.component';

@NgModule({
  imports: [ ResumeRoutingModule ],
  declarations: [ 
    ResumeComponent,
    HeaderComponent,
    WelcomeComponent,
    AboutComponent,
    ExperienceComponent,
    PostsComponent,
    ContactComponent
  ],
  exports: [ResumeComponent ]
})

export class ResumeModule { }
