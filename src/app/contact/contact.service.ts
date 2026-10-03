import { inject, Injectable } from '@angular/core';
import type { CollectionReference, DocumentReference } from 'firebase/firestore';
import { FIREBASE_APP } from '../core/firebase';
import { Contact } from '../model/contact.model';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly app = inject(FIREBASE_APP);

  async createContact(contact: Contact): Promise<DocumentReference<Contact>> {
    // Firestore is only needed when a message is sent, so it is loaded on demand.
    const { getFirestore, collection, addDoc } = await import('firebase/firestore');
    const contactsCollection = collection(getFirestore(this.app), 'contacts') as CollectionReference<Contact>;
    return addDoc(contactsCollection, contact);
  }
}
