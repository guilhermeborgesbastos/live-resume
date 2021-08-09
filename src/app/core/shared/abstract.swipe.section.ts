import { SwipeSection } from "./swipe.section";

enum Direction {
    LEFT,
    RIGHT,
    NOT_READABLE
}

export abstract class AbstractSwipeSection implements SwipeSection {

    private horizontalSwipeRatio: number;

    private readonly horizontalStartPoint = 0;

    constructor(horizontalSwipeRatio: number = 40) {
        this.horizontalSwipeRatio = horizontalSwipeRatio;
    }

    onSwipe(event: any): void {
        const direction: Direction = this.getEventSwipeDirection(event);
        if(!this.disablePreviousNavigation() && direction === Direction.RIGHT) {
            this.onClickPrevious();
        } else if(!this.disableNextNavigation() && direction === Direction.LEFT) {
            this.onClickNext();
        } 
    }

    private getEventSwipeDirection(event: any): Direction | undefined {
        if(Math.abs(event.deltaX) > this.horizontalSwipeRatio) {
            return event.deltaX > this.horizontalStartPoint ? Direction.RIGHT : Direction.LEFT;
        }
        return Direction.NOT_READABLE;
    }

    abstract disablePreviousNavigation(): boolean;

    abstract disableNextNavigation(): boolean;

    abstract onClickPrevious(): void;

    abstract onClickNext(): void;

}