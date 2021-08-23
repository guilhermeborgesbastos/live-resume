export declare interface SwipeSection {

    onSwipe(event: any): void;

    disablePreviousNavigation(): boolean;

    disableNextNavigation(): boolean;

    onClickPrevious(): void;

    onClickNext(): void;
}