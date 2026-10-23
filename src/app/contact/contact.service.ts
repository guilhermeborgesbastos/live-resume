import { inject, Injectable, NgZone } from '@angular/core';
import type { CollectionReference, DocumentReference } from 'firebase/firestore';
import { FIREBASE_APP } from '../core/firebase';
import { Contact } from '../model/contact.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly app = inject(FIREBASE_APP);
  private readonly zone = inject(NgZone);

  private appCheck: Promise<void>;

  /** Whether the contact form is protected by App Check (a reCAPTCHA site key is configured). */
  readonly isProtected = !!environment.recaptchaSiteKey;

  /**
   * Starts Firebase App Check with reCAPTCHA Enterprise (Google Cloud Fraud Defense), so Firestore
   * can reject writes that do not come from a real visitor on this site (once enforcement is enabled
   * in the Firebase console).
   * Called when the visitor starts filling in the form: reCAPTCHA stays out of the initial page
   * load but still sees how the visitor interacts with the form before it scores them.
   */
  protect(): Promise<void> {
    if (!this.isProtected) {
      return Promise.resolve();
    }
    // reCAPTCHA schedules its own timers; keep them from triggering change detection.
    this.appCheck ??= this.zone.runOutsideAngular(async () => {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
      initializeAppCheck(this.app, {
        provider: new ReCaptchaEnterpriseProvider(environment.recaptchaSiteKey),
        // Tokens are only needed when a message is sent, so they are not refreshed in the background.
        isTokenAutoRefreshEnabled: false
      });
    });
    return this.appCheck;
  }

  async createContact(contact: Contact): Promise<DocumentReference<Contact>> {
    // App Check must be running before Firestore sends the write, so the write carries its token.
    await this.protect();
    // Firestore is only needed when a message is sent, so it is loaded on demand.
    const { getFirestore, collection, addDoc } = await import('firebase/firestore');
    const contactsCollection = collection(getFirestore(this.app), 'contacts') as CollectionReference<Contact>;
    return addDoc(contactsCollection, contact);
  }
}
