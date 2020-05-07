import { Component, OnInit } from '@angular/core';
import {
  faEnvelope, faPhone,
  faMapMarkerAlt, IconDefinition
} from '@fortawesome/free-solid-svg-icons';
import { FormGroup, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss', './contact.component.responsivity.scss']
})

export class ContactComponent implements OnInit {

  name: string;
  email: string;
  phone: string;
  location: string;
    
  faEnvelope: IconDefinition;
  faPhone: IconDefinition;
  faMapMarkerAlt: IconDefinition;

  constructor() { }

  formContact: FormGroup = new FormGroup({
    email: new FormControl('',[
      Validators.required,
      Validators.pattern("^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$")
    ]),
    name: new FormControl('',[
      Validators.required,
      Validators.pattern("[A-zÀ-ú ]*")
    ]),
    message: new FormControl('',[
      Validators.required
      // Validators.pattern("^(?!\s*$).+")
    ]),
  }); 

  get senderEmail(){
    return this.formContact.get('email')
  }

  get senderName(){
    return this.formContact.get('name')
  }

  get senderMessage(){
    return this.formContact.get('message')
  }

  ngOnInit(): void {
    this.name = "Guilherme Borges Bastos";
    this.email = "guilhermeborgesbastos@gmail.com";
    this.phone = "+55 34 98400 9731";
    this.location = "Uberaba, Minas Gerais - Brazil";

    this.faEnvelope = faEnvelope;
    this.faPhone = faPhone;
    this.faMapMarkerAlt = faMapMarkerAlt;
  }

  submitEmail() {
    console.log('sensing email...');
  }
}
