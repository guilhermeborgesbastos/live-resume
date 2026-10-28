import { inject, Injectable, NgZone } from "@angular/core";
import { FIREBASE_APP } from "./firebase";
import { environment } from "../../environments/environment";

/**
 * Starts Firebase App Check with reCAPTCHA Enterprise (Google Cloud Fraud Defense), shared by the
 * contact form (Firestore writes) and the CV assistant's hosted answers (the askAssistant
 * function). Firebase rejects requests without a valid token once enforcement is on.
 *
 * Started on demand, when the visitor focuses the contact form or opens the assistant, so
 * reCAPTCHA stays out of the initial page load but still sees how the visitor interacts with the
 * page before it scores them.
 */
@Injectable({ providedIn: "root" })
export class AppCheckService {
  private readonly app = inject(FIREBASE_APP);
  private readonly zone = inject(NgZone);

  private started?: Promise<void>;

  /** Whether App Check is configured (a reCAPTCHA site key is set). */
  readonly configured = !!environment.recaptchaSiteKey;

  start(): Promise<void> {
    if (!this.configured) {
      return Promise.resolve();
    }
    // reCAPTCHA schedules its own timers; keep them from triggering change detection.
    this.started ??= this.zone.runOutsideAngular(async () => {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import("firebase/app-check");
      initializeAppCheck(this.app, {
        provider: new ReCaptchaEnterpriseProvider(environment.recaptchaSiteKey),
        // Tokens are only needed when a message or question is sent, so they are not refreshed in the background.
        isTokenAutoRefreshEnabled: false
      });
    });
    return this.started;
  }
}
