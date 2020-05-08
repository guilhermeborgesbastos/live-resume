import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css', './footer.component.responsivity.css']
})
export class FooterComponent implements OnInit {

  year: Date;

  constructor() { }

  ngOnInit(): void {
    this.year = new Date();
  }

}
