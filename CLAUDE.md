# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Live Resume: a single-page personal resume/portfolio built with Angular 21 (the LTS line; TypeScript 5.9, Zone.js change detection). It ships in two locales (en, pt) and uses Firebase for the contact form and analytics. Node `^20.19 || ^22.12 || ^24` is supported; `.nvmrc` pins Node 24.

## Commands

```bash
npm ci                              # clean install from the lockfile; no --force / --legacy-peer-deps needed
npm run start:en                    # dev server on :4200 in English (start:pt for Portuguese)
npx ng serve -o --host 0.0.0.0 --configuration en   # README's way to serve, reachable from other devices
npm run build                       # default build -> dist/live-resume (add -- --configuration production for budgets)
npm run build-locale                # production-style build of both locales -> dist/en, dist/pt
npm run lint                        # ng lint (angular-eslint, flat config in eslint.config.js)
npm test -- --watch=false --browsers=ChromeHeadless   # Karma + Jasmine unit specs (core pipes/services)
npx ng test --include src/app/path/to/file.spec.ts    # run a single spec
npm run test:e2e                    # build both locales, then run the Playwright browser suite (e2e/)
npm run test:e2e:run                # rerun the browser suite against the existing dist/ output
npm run test:e2e:docker             # build the Docker image, run it on :8080 and run the browser suite against it
docker build -t live-resume . && docker run --rm -p 8080:80 live-resume   # serve http://localhost:8080/en/ and /pt/
npm run int:extract                 # regenerate src/locales/messages.xlf (ng extract-i18n)
```

**Browser suite (required gate before every commit).** `e2e/resume.spec.ts` runs Chromium at desktop and mobile (Pixel 7) viewports against the localized production builds served by `e2e/serve.mjs` on `http://127.0.0.1:4300/{en,pt}/` (`E2E_PORT` overrides the port). `e2e/fixtures.ts` stubs Firebase/gtag bootstrap calls, aborts Firestore writes and blocks all other third-party traffic, and fails a test on console errors, page errors or failed first-party requests. Output goes to `test-results/` (HTML report, landing screenshots per locale/viewport in `test-results/screenshots/`, traces/screenshots on failure). First run needs `npx playwright install chromium`. CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, unit tests, the production build and `npm run test:e2e`.

**Docker.** `Dockerfile` builds both locales in a `node:24-slim` stage that is discarded, and the runtime image is `nginx:1.30-alpine-slim` with only the static files (no Node); `docker/nginx.conf` redirects `/en` and `/pt` to `/en/` and `/pt/`, serves each locale's `index.html` for extension-less paths under it, returns 404 for missing files and for anything outside the locale prefixes. `e2e/serve.mjs` follows the same contract, and `E2E_BASE_URL` points the browser suite at any running server (the container via `npm run test:e2e:docker`).

**Releases.** Pushing a tag `vX.Y.Z` runs `.github/workflows/docker-publish.yml`: it fails unless the tag equals `package.json`'s version, runs `npm run test:e2e:docker`, then pushes `docker.io/guilhermeborgesbastos/live-resume` for linux/amd64 + arm64 as `X.Y.Z`, `X.Y`, `X`, `latest` and `sha-<commit>` (pre-releases only `X.Y.Z-…`). Bump the version with `npm version X.Y.Z --no-git-tag-version` in a PR and update CHANGELOG.md before tagging. Needs the `DOCKERHUB_TOKEN` secret (`DOCKERHUB_USERNAME` variable optional). PRs touching the image run the workflow without pushing.

`deploy.sh` builds both locales, stages `dist/<locale>/browser/<locale>/` as `dist/site/<locale>/`, then empties the S3 bucket `www.guilhermeborgesbastos.com` and uploads each locale to its `en/` / `pt/` prefix (served as https://guilhermeborgesbastos.com/en/ and /pt/). It is destructive and must not be run during development; `./deploy.sh --stage-only` builds and stages without touching S3. The script stops before touching S3 if the build fails or a locale's `index.html` is missing.

## Architecture

**One page, many sections.** `AppRoutingModule` routes only `""` to `ResumeComponent`; `/about`, `/experience`, `/posts`, `/contact` redirect to fragments (`/#about`, etc.) and everything else goes to the standalone 404 component. `ResumeComponent` stacks the section components (welcome, about, experience, posts, contact, footer) and tracks scroll/visibility through `appInViewport` (`core/directive/on-viewport.directive.ts`) to set the header's `activeSection`.

**Content lives in JSON, not in templates.** `core/data.service.ts` loads `src/assets/data/{about,experiences,posts}.json`. Each record has an `internationalizations` array of per-language objects (`language: "en" | "pt"`). Templates render those fields with the `appInternationalization` directive (`[data]="item.internationalizations" property="description"`), which picks the entry matching `LOCALE_ID` and writes it via `innerHTML` — so JSON strings can contain HTML. When editing resume content, update both the `en` and `pt` entries.

**Two i18n mechanisms coexist:**
- Static UI strings use Angular `@angular/localize` (`i18n="meaning@@id"` attributes) with translations in `src/locales/messages.{en,pt}.xlf`. The `en`/`pt` build configs set `i18nMissingTranslation: "error"`, so a new `i18n` attribute without entries in **both** xlf files breaks the localized build. Source locale is `en-US`.
- Dynamic content uses the JSON `internationalizations` arrays described above.

**Modules.** `main.ts` bootstraps `AppModule` with `platformBrowserDynamic` and `provideZoneChangeDetection()` (the app is not zoneless). Components, directives and pipes are standalone but are composed through NgModules (`ResumeModule`, `PostsModule`, ...); `CoreModule` provides `DataService`, `SorterService`, HttpClient, and exports shared pipes/directives (localized/Safari-safe date pipes, ellipsis, i18n and viewport directives). Dependencies use `inject()`, templates use built-in control flow (`@if`/`@for`), and `strictTemplates` is on. The 404 page is lazy-loaded via `loadComponent`.

**Carousels and swipe.** Experience and posts carousels extend `core/shared/abstract.swipe.section.ts`, implementing `onClickPrevious/onClickNext` and the `disable*Navigation` guards; HammerJS swipe config lives in `AppModule`. Post cards fade with `animate.enter`/`animate.leave` CSS classes (the deprecated `@angular/animations` package is not used).

**Firebase.** The modular `firebase` SDK is used directly (no AngularFire). `core/firebase.ts` provides the `FIREBASE_APP` token initialized from `environment.firebaseConfig`; `contact/contact.service.ts` lazily imports Firestore and writes to the `contacts` collection; `core/analytics.service.ts` (started by `AppComponent`) lazily initializes Analytics outside the Angular zone and logs a `screen_view` per navigation. Personal details (name, birth date, email, location, caricature image) are in `src/environments/environment*.ts`; `environment.prod.ts` is swapped in for production builds.

**Styling.** Each component typically has a `*.scss`/`*.css` plus a separate `*.responsivity.*` file for breakpoints. Production budget for component styles is 6kb warning / 10kb error.
