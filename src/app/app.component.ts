import { Component, OnInit, inject } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";
import { RouterOutlet } from "@angular/router";
import { environment } from "../environments/environment";
import { AnalyticsService } from "./core/analytics.service";

const OWNER = environment.personal;

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.css"],
    imports: [RouterOutlet]
})
export class AppComponent implements OnInit {
  private titleService = inject(Title);
  private metaTagService = inject(Meta);
  private analyticsService = inject(AnalyticsService);


  title: string = `Live Resume - ${OWNER.name}`;

  ngOnInit(): void {

    this.analyticsService.start();

    this.titleService.setTitle(this.title);

    this.metaTagService.addTags([
      { name: "keywords", content: `${OWNER.name} Live Resume, ${OWNER.name} Resume, ${OWNER.name} CV, Curriculum ${OWNER.name}, ${OWNER.brand} live resume` },
      { name: "robots", content: "index, follow" },
      { name: "author", content: OWNER.name },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "date", content: "2020-05-12", scheme: "YYYY-MM-DD" },
      { charset: "UTF-8" }
    ]);

    this.metaTagService.updateTag(
      { name: "description", content: OWNER.pitch }
    );
  }
}
