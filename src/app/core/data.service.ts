import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";

import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";

import { IExperience } from "../experience/experience-interfaces";
import { IAbout } from "../about/about-interfaces";
import { IPost } from "../posts/posts-interfaces";

@Injectable()
export class DataService {
    private http = inject(HttpClient);


    baseUrl: string = "assets/data/";

    // Browsers that cached these files before they were served with no-cache keep reusing
    // years-old copies; this header makes every load skip the HTTP cache.
    private readonly noCache = { headers: new HttpHeaders({ "Cache-Control": "no-cache" }) };

    getExperiences() : Observable<IExperience[]> {
        return this.http.get<IExperience[]>(this.baseUrl + "experiences.json", this.noCache)
            .pipe(
                catchError(this.handleError)
            );
    }
    
    getAbout() : Observable<IAbout> {
      return this.http.get<IAbout>(this.baseUrl + "about.json", this.noCache)
          .pipe(
              catchError(this.handleError)
          );
    }

    getPosts() : Observable<IPost[]> {
        return this.http.get<IPost[]>(this.baseUrl + "posts.json", this.noCache)
            .pipe(
                catchError(this.handleError)
            );
    }

    private handleError(error: any) {
      console.error("server error:", error);
      if (error.error instanceof Error) {
          const errMessage = error.error.message;
          return throwError(() => errMessage);
          // Use the following instead if using lite-server
          // return Observable.throw(err.text() || "backend server error");
      }
      return throwError(() => error || "Node.js server error");
    }
}