import { NgModule }     from '@angular/core';
import { WelcomeComponent } from './welcome.component';
import { WelcomeBackgroundComponent } from './welcome-background/welcome-background.component';
import { WelcomeDialogComponent } from './welcome-dialog/welcome-dialog.component';
import { TypingAnimationModule } from './welcome-dialog/welcome-dialog-typing/typing-animation.module';

@NgModule({
  imports: [ TypingAnimationModule ],
  declarations: [ WelcomeComponent, WelcomeBackgroundComponent, WelcomeDialogComponent ],
  exports: [ WelcomeComponent ]
})

export class WelcomeModule { }