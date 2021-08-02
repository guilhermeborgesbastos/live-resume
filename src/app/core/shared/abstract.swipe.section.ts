import { SwipeSection } from './swipe.section';

export enum Direction {
    Left,
    Right,
}

export abstract class AbstractSwipeSection implements SwipeSection {

    constructor() {
    }

    onSwipe(event: any): void {
        const direction: Direction = Math.abs(event.deltaX) > 40 ? (event.deltaX > 0 ? Direction.Right : Direction.Left) : undefined;
        if(!this.disablePreviousNavigation() && direction === Direction.Right) {
            this.onClickPrevious();
        } else if(!this.disableNextNavigation() && direction === Direction.Left) {
            this.onClickNext();
        } 
    }

    abstract disablePreviousNavigation(): boolean;

    abstract disableNextNavigation(): boolean;

    abstract onClickPrevious(): void;

    abstract onClickNext(): void;

}