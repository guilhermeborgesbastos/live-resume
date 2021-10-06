import { Component, OnInit } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";
import { initializeApp } from 'firebase/app';

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnInit {

  title: string = "Vaibhav Kumar Katturu";

  constructor(
    private titleService: Title,
    private metaTagService: Meta
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle(this.title);

    this.metaTagService.addTags([
      { name: "keywords", content: "Research Scientist, Game Developer, Full-stack Developer, DevOps Engineer, Android Developer, Vaibhav Kumar Katturu Resume, Vaibhav Kumar Katturu CV, Curriculum Vaibhav Kumar Katturu, Vkatturu live resume" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "Vaibhav Kumar Katturu" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "date", content: "2020-05-12", scheme: "YYYY-MM-DD" },
      { charset: "UTF-8" }
    ]);

    this.metaTagService.updateTag(
      { name: "description", content: "Hello, I am Recent Graduate from Pace University, currently I working as a Research Assistant in a two person team" }
    );
  }
}
