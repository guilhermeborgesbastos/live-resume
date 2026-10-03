import { DestroyRef, inject, Injectable, NgZone } from "@angular/core";
import { ActivatedRouteSnapshot, NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { FIREBASE_APP } from "./firebase";

/**
 * Google Analytics for Firebase: initializes analytics (which records the page view) and
 * logs a `screen_view` event for every router navigation.
 */
@Injectable({ providedIn: "root" })
export class AnalyticsService {

  private readonly app = inject(FIREBASE_APP);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    // Analytics schedules its own timers; keep them from triggering change detection.
    this.zone.runOutsideAngular(async () => {
      const { getAnalytics, isSupported, logEvent } = await import("firebase/analytics");
      if (!(await isSupported())) {
        return;
      }
      const analytics = getAnalytics(this.app);
      const logScreen = (url: string) => logEvent(analytics, "screen_view", {
        firebase_screen: url,
        firebase_screen_class: this.screenClass(this.router.routerState.snapshot.root)
      });

      // The initial navigation may already have finished while the SDK was loading.
      if (this.router.navigated) {
        logScreen(this.router.url);
      }
      const subscription = this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(event => logScreen(event.urlAfterRedirects));
      this.destroyRef.onDestroy(() => subscription.unsubscribe());
    });
  }

  private screenClass(route: ActivatedRouteSnapshot): string {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.component?.name || "AppComponent";
  }
}
