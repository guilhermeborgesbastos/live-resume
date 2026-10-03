import { NgModule } from "@angular/core";
import { TypingAnimationDirective } from "./typing-animation.directive";

@NgModule({
    imports: [TypingAnimationDirective],
    exports: [
        TypingAnimationDirective
    ]
})
export class TypingAnimationModule {}