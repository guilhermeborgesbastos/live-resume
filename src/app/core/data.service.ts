import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { IExperience } from '../experience/experience-interfaces';

@Injectable()
export class DataService {

    baseUrl: string = 'assets/data/';
    
    constructor(private http: HttpClient) { }

    getExperiences() : Observable<IExperience[]> {
        return this.http.get<IExperience[]>(this.baseUrl + 'experiences.json')
            .pipe(
                catchError(this.handleError)
            );
    }
    
    getExperience(id: number) : Observable<IExperience> {
      return this.http.get<IExperience[]>(this.baseUrl + 'experiences.json')
        .pipe(
          map(experiences => {
            let experience = experiences.filter((exp: IExperience) => exp.id === id);
            return (experience && experience.length) ? experience[0] : null;
          }),
          catchError(this.handleError)
        )
    }

    private handleError(error: any) {
      console.error('server error:', error);
      if (error.error instanceof Error) {
          const errMessage = error.error.message;
          return Observable.throw(errMessage);
          // Use the following instead if using lite-server
          // return Observable.throw(err.text() || 'backend server error');
      }
      return Observable.throw(error || 'Node.js server error');
    }

}