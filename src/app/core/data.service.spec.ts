import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { DataService } from "./data.service";

describe("DataService", () => {
  let service: DataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DataService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("loads every data file past the browser cache", () => {
    service.getAbout().subscribe();
    service.getExperiences().subscribe();
    service.getPosts().subscribe();
    for (const file of ["about", "experiences", "posts"]) {
      const request = http.expectOne(`assets/data/${file}.json`);
      expect(request.request.headers.get("Cache-Control")).toBe("no-cache");
      request.flush(file === "about" ? {} : []);
    }
  });
});
