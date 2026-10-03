# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Live Resume: a single-page personal resume/portfolio built with Angular 19 (README still says Angular 15; the current branch is a migration toward latest Angular). It ships in two locales (en, pt) and uses Firebase for the contact form and analytics.

## Commands

```bash
npm install --force                 # --force is required (peer-dep conflicts, e.g. @angular-eslint versions)
npm run start:en                    # dev server on :4200 in English (start:pt for Portuguese)
ng serve -o --host 0.0.0.0 --configuration en   # README's way to serve, reachable from other devices
npm run build                       # default build -> dist/live-resume
npm run build-locale                # production-style build of both locales -> dist/en, dist/pt
npm run lint                        # ng lint (angular-eslint)
npm test                            # Karma + Jasmine (there are currently no *.spec.ts files)
ng test --include src/app/path/to/file.spec.ts   # run a single spec
npm run int:extract                 # regenerate src/locales/messages.xlf (ng extract-i18n)
```

`deploy.sh` builds both locales and syncs `dist/en` and `dist/pt` to the S3 bucket `www.guilhermeborgesbastos.com` (destructive: it empties the bucket first).

## Architecture

**One page, many sections.** `AppRoutingModule` routes only `""` to `ResumeComponent`; `/about`, `/experience`, `/posts`, `/contact` redirect to fragments (`/#about`, etc.) and everything else goes to the standalone 404 component. `ResumeComponent` stacks the section components (welcome, about, experience, posts, contact, footer) and tracks scroll/visibility through `appInViewport` (`core/directive/on-viewport.directive.ts`) to set the header's `activeSection`.

**Content lives in JSON, not in templates.** `core/data.service.ts` loads `src/assets/data/{about,experiences,posts}.json`. Each record has an `internationalizations` array of per-language objects (`language: "en" | "pt"`). Templates render those fields with the `appInternationalization` directive (`[data]="item.internationalizations" property="description"`), which picks the entry matching `LOCALE_ID` and writes it via `innerHTML` — so JSON strings can contain HTML. When editing resume content, update both the `en` and `pt` entries.

**Two i18n mechanisms coexist:**
- Static UI strings use Angular `@angular/localize` (`i18n="meaning@@id"` attributes) with translations in `src/locales/messages.{en,pt}.xlf`. The `en`/`pt` build configs set `i18nMissingTranslation: "error"`, so a new `i18n` attribute without entries in **both** xlf files breaks the localized build. Source locale is `en-US`.
- Dynamic content uses the JSON `internationalizations` arrays described above.

**Modules.** Mostly NgModule-based (`standalone: false` on most components); `CoreModule` provides `DataService`, `SorterService`, HttpClient, and exports shared pipes/directives (localized/Safari-safe date pipes, ellipsis, i18n and viewport directives). Newer pieces (404 page) are standalone — migration toward standalone is in progress.

**Carousels and swipe.** Experience and posts carousels extend `core/shared/abstract.swipe.section.ts`, implementing `onClickPrevious/onClickNext` and the `disable*Navigation` guards; HammerJS swipe config lives in `AppModule`.

**Firebase.** `AppModule` wires `@angular/fire` (Firestore, Analytics, Auth, Realtime DB) from `environment.firebaseConfig`. The contact form writes to the Firestore `contacts` collection via `contact/contact.service.ts`. Personal details (name, birth date, email, location, caricature image) are in `src/environments/environment*.ts`; `environment.prod.ts` is swapped in for production builds.

**Styling.** Each component typically has a `*.scss`/`*.css` plus a separate `*.responsivity.*` file for breakpoints. Production budget for component styles is 6kb warning / 10kb error.
