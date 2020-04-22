import { Component, OnInit } from '@angular/core';
import {  faChevronLeft , faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faGithub, faFacebook, IconDefinition} from '@fortawesome/free-brands-svg-icons';
import { IExperience } from './experience-interfaces';
import { DataService } from '../core/data.service';

@Component({
  selector: 'app-experience',
  templateUrl: './experience.component.html',
  styleUrls: ['./experience.component.scss']
})
export class ExperienceComponent implements OnInit {
  
  faLinkedin: IconDefinition;
  faGithub: IconDefinition;
  faFacebook: IconDefinition;
  faChevronLeft: IconDefinition;
  faChevronRight: IconDefinition;

  experiences: IExperience[];

  constructor(private dataService: DataService) { }

  ngOnInit(): void {
    this.faLinkedin = faLinkedin;
    this.faGithub = faGithub;
    this.faFacebook = faFacebook;
    this.faChevronLeft = faChevronLeft;
    this.faChevronRight = faChevronRight;

    // Fetch the Experiences from the Data Service
    this.dataService.getExperiences()
        .subscribe((experiences: IExperience[]) => this.experiences = experiences);
  }

}
