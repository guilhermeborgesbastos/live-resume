import { Component, DestroyRef, ElementRef, Input, LOCALE_ID, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { IAbout, IAboutCertification } from "../about-interfaces";

/** The fragments AI Assistant citations use for the records shown here. */
export const ABOUT_DETAIL_ANCHORS = ["education", "languages", "certifications"];
export const TOPIC_ANCHOR_PREFIX = "topic-";

/*
 * Education, languages, certifications and focus areas from about.json, under the About card.
 * AI Assistant answers cite these records with a fragment (/#education, /#topic-devops, ...): a
 * cited topic opens, and the target is scrolled into view once the data has rendered (the router
 * can only scroll to it on its own when the section was already on the page).
 */
@Component({
  selector: "app-about-details",
  templateUrl: "./about-details.component.html",
  styleUrls: ["./about-details.component.scss"]
})
export class AboutDetailsComponent {
  private locale = inject(LOCALE_ID);
  private host = inject(ElementRef);
  private destroyRef = inject(DestroyRef);

  private _about?: IAbout;
  /** The cited fragment, if it names a record shown here. */
  fragment: string | null = null;

  @Input() set about(value: IAbout | undefined) {
    this._about = value;
    this.revealFragment();
  }

  get about(): IAbout | undefined {
    return this._about;
  }

  constructor() {
    inject(ActivatedRoute).fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(fragment => {
        this.fragment = fragment;
        this.revealFragment();
      });
  }

  get hasDetails(): boolean {
    const about = this._about;
    return !!about && [about.education, about.languages, about.certifications, about.topics].some(list => (list?.length ?? 0) > 0);
  }

  /** The value of `key` in the entry for the site's locale, or "" when absent. */
  localized(entries: { language: string }[] | undefined, key: string): string {
    const entry = entries?.find(e => e.language === (this.locale || "en")) as Record<string, unknown> | undefined;
    const value = entry?.[key];
    return typeof value === "string" ? value : "";
  }

  /** "2022" from "06-2022" or "2022": the year is enough here; answers give the month. */
  year(date: string | undefined): string {
    return date ? date.slice(-4) : "";
  }

  isOpenTopic(id: string): boolean {
    return this.fragment === TOPIC_ANCHOR_PREFIX + id;
  }

  trackCertification(certification: IAboutCertification): string {
    return `${certification.name}|${certification.issuedAt}`;
  }

  private revealFragment(): void {
    const fragment = this.fragment;
    const ours = fragment && (ABOUT_DETAIL_ANCHORS.includes(fragment) || fragment.startsWith(TOPIC_ANCHOR_PREFIX));
    if (!ours || !this._about) {
      return;
    }
    // After this change detection pass has rendered the records (and opened a cited topic).
    setTimeout(() => {
      const target = (this.host.nativeElement as HTMLElement).querySelector(`[id="${CSS.escape(fragment)}"]`);
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
}
