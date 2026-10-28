import { inject, Injectable } from '@angular/core';
import type { CollectionReference, DocumentReference } from 'firebase/firestore';
import { AppCheckService } from '../core/app-check.service';
import { FIREBASE_APP } from '../core/firebase';
import { Contact } from '../model/contact.model';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly app = inject(FIREBASE_APP);
  private readonly appCheck = inject(AppCheckService);

  /** Whether the contact form is protected by App Check (a reCAPTCHA site key is configured). */
  readonly isProtected = this.appCheck.configured;

  /**
   * Starts App Check so Firestore can reject writes that do not come from a real visitor on this
   * site (once enforcement is enabled in the Firebase console). Called when the visitor starts
   * filling in the form.
   */
  protect(): Promise<void> {
    return this.appCheck.start();
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
