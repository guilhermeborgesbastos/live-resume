import { Component, OnInit } from '@angular/core';
import { faGithubSquare, IconDefinition } from '@fortawesome/free-brands-svg-icons';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css', './footer.component.responsivity.css']
})
export class FooterComponent implements OnInit {

  faGithubSquare: IconDefinition;

  year: Date;

  constructor() { }

  ngOnInit(): void {
    this.faGithubSquare = faGithubSquare;
    this.year = new Date();
  }

}
