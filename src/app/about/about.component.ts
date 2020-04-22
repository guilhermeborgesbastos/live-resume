import { Component, OnInit } from '@angular/core';
import { 
  faBiking,
  faDumbbell,
  faSuitcaseRolling,
  faBook,
  IconDefinition
} from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faGithub, faFacebook } from '@fortawesome/free-brands-svg-icons';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css', './about.component-responsivity.css']
})
export class AboutComponent implements OnInit {
  
  name: string;
  yearsOld: number;

  linkedinUrl: string;
  githubUrl: string;
  facebookUrl: string;

  faBiking: IconDefinition;
  faDumbbell: IconDefinition;
  faSuitcaseRolling: IconDefinition;
  faBook: IconDefinition;
  faLinkedin: IconDefinition;
  faGithub: IconDefinition;
  faFacebook: IconDefinition;

  constructor() { }

  ngOnInit(): void {
    this.name = 'Guilherme Borges Bastos'
    this.yearsOld = this.calcAge("1993-06-29"); // Sets here, your date birthday

    this.linkedinUrl = 'https://www.linkedin.com/in/guilhermeborgesbastos/';
    this.githubUrl = 'https://github.com/guilhermeborgesbastos';
    this.facebookUrl = 'https://www.facebook.com/guilherme.borgesbastos';

    this.faBiking = faBiking;
    this.faDumbbell = faDumbbell;
    this.faSuitcaseRolling = faSuitcaseRolling;
    this.faBook = faBook;
    this.faLinkedin = faLinkedin;
    this.faGithub = faGithub;
    this.faFacebook = faFacebook;
  }

  private calcAge(dateString: string) {
    const birthday = new Date(dateString);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getFullYear() - 1970);
  }
  

}
