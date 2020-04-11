import { Component, OnInit } from '@angular/core';
import { faBars } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements OnInit {
  
  title: string;
  faBars = faBars;

  constructor() { }

  ngOnInit(): void {
    this.title = 'gbastos';
  }

}
