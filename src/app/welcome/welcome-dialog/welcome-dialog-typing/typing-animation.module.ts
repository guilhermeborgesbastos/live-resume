import { NgModule } from '@angular/core'
import { TypingAnimationDirective } from './typing-animation.directive'

@NgModule({
    declarations: [
        TypingAnimationDirective
    ],
    exports: [
        TypingAnimationDirective
    ]
})
export class TypingAnimationModule {}