import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { IExperience } from '../experience/experience-interfaces';
import { IAbout } from '../about/about-interfaces';
import { IPost } from '../posts/posts-interfaces';

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
    
    getAbout() : Observable<IAbout> {
      return this.http.get<IAbout>(this.baseUrl + 'about.json')
          .pipe(
              catchError(this.handleError)
          );
    }

    getPosts() : Observable<IPost[]> {
        return this.http.get<IPost[]>(this.baseUrl + 'posts.json')
            .pipe(
                catchError(this.handleError)
            );
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