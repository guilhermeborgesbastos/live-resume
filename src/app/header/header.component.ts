import { Component, OnInit } from '@angular/core';
import { faBars, IconDefinition } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

export class HeaderComponent implements OnInit {
  
  hasMenuToggled: boolean;
  faBars: IconDefinition;
  title: string;

  constructor() { }

  ngOnInit(): void {
    this.title = 'gbastos';
    this.faBars = faBars;
    this.hasMenuToggled = true;
  }

  onToggleBar() {
    this.hasMenuToggled = !this.hasMenuToggled;
  }

}
