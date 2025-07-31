import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, CollectionReference, DocumentReference, docData, doc } from '@angular/fire/firestore';
import { Contact } from '../model/contact.model';

@Injectable({ providedIn: 'root' })
export class ContactService {
  constructor(private firestore: Firestore) {}

  // Add a new contact
  createContact(contact: Contact): Promise<DocumentReference<Contact>> {
    const contactsCollection = collection(this.firestore, 'contacts') as CollectionReference<Contact>;
    return addDoc(contactsCollection, contact);
  }
}
