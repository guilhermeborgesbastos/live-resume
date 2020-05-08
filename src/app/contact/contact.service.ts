import { AngularFirestore, DocumentReference } from '@angular/fire/firestore';
import { Contact } from '../model/contact.model';
import { Injectable } from '@angular/core';

@Injectable()
export class ContactService {

    constructor(private database: AngularFirestore) { }

    createContact(contact: Contact): Promise<DocumentReference> {
        return this.database.collection<Contact>('contacts').add(contact);
    }
}