#[2.2.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v2.2.0) (2026-10-30)
###📃 release notes
- AI Assistant: questions the rule-based assistant can't answer can go to Claude Haiku 5.5 through a Firebase Cloud Function (`functions/`). The answer is written from the CV JSON and the owner's notes in `src/assets/data/assistant-context.txt`, checked against them, labelled as AI-generated and shown with its sources. It is protected by App Check, daily, monthly and per-visitor limits, a kill switch and a budget backstop, and it stays off until it's set up (DEPLOYMENT.md, "AI answers (Firebase)");
- The function keeps each question that reaches the model, with its answer, in Firestore for 90 days, with nothing that identifies the visitor;
- Firestore security rules now live in the repository (`firestore.rules`, checked with `npm run test:rules`);
- The CV data is always loaded fresh, so browsers that cached an old copy no longer show an outdated CV;
- `/pt/` and `/pt/assistant` serve the Portuguese site on S3/CloudFront through a CloudFront Function (`cloudfront/locale-routing.js`, DEPLOYMENT.md step 6);
- Easier to fork: the tests run on a frozen copy of the CV (`src/testing/cv/`), the committed environment files no longer point at the maintainer's Firebase project (the site runs without Firebase until you add yours), the owner's name, logo, CV file, site address and share text come from `environment.personal`, and the README lists everything to change;
- Update the Angular tooling to 21.2.29 and fix the dependency vulnerabilities reported by Dependabot (29 of 31; the remaining two are in Firebase's Node-only gRPC code).

**Upgrading a fork:** add `brand`, `cvFile`, `siteUrl` and `pitch` to `personal` in both environment files, or the build fails. The Docker image is built from the committed files, so it now runs without Firebase: no analytics or AI answers, and the contact form shows its error message.

#[2.1.1](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v2.1.1) (2026-10-27)
###📃 release notes
- Scroll smoothly between resume sections (e.g. from Posts to Contact) instead of jumping; visitors who ask for reduced motion keep the instant jump.

#[2.1.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v2.1.0) (2026-10-27)
###📃 release notes
- Add the AI Assistant: a rule-based, browser-only Q&A that answers questions about the CV in English and Portuguese from the about/experiences/posts JSON, cites the source of every fact and points anything it can't answer to the Contact section. It is reachable from the header, a floating "Ask my AI Assistant" button and the new `/assistant` page. See `docs/ai-assistant-data.md` to update its data;
- AI Assistant: "Did you mean…" options for misspelled or ambiguous names, follow-ups about the role in the latest answer ("And before that?"), and third-person questions ("What did he achieve at Swisscom?");
- Add education, certifications, spoken languages, topic summaries and per-role highlights to the CV data;
- Draw attention to the AI Assistant: a "New" badge and a one-time highlight on the header link, and a welcome greeting that invites visitors to ask it;
- Keep a `#fragment` target (e.g. `#contact`) in view while the resume's data-driven sections render, so deep links land on the right section on phones;
- Keep the active section (header highlight and assistant button) in sync while scrolling through tall sections.

#[2.0.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v2.0.0) (2026-10-04)
###📃 release notes
- Upgrade to Angular 21.2.25 (LTS) and Typescript 5.9.3, via Angular 20;
- Node.js 20.19+, 22.12+ or 24 is required (Node 24 pinned in `.nvmrc`); `npm ci` no longer needs `--force`;
- Use the modular Firebase SDK directly instead of AngularFire, loading Firestore and Analytics on demand (smaller initial bundle);
- Replace `ng-navigator-share` with the native Web Share API and `@angular/animations` with `animate.enter`/`animate.leave`;
- Replace Protractor with a Playwright browser test suite (`npm run test:e2e`) and add unit specs and a CI workflow;
- Upgrade angular-eslint to 21 with an ESLint 9 flat config; enable strict template type checking.
- Add a Docker image (Nginx) serving both locales at `/en/` and `/pt/`, and `npm run test:e2e:docker` to run the browser suite against it.
- Publish the Docker image to Docker Hub (`guilhermeborgesbastos/live-resume`, amd64 + arm64) from a GitHub Actions workflow on version tags.

#[1.8.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.8) (2023-03-22)
###📃 release notes
- Upgrade to Angular 15.2.3;
- Upgrade to Typescript 4.8.4.

#[1.7.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.7) (2022-01-18)
###📃 release notes
- Upgrade to Angular 13.1.2;
- Replace TSLint by ESLint;
- Upgrade to Typescript 4.5.4.

#[1.6.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.6) (2022-01-14)
###📃 release notes
- Upgrade to Angular 12.2.15;
- Upgrade to Typescript 4.3.5;
- Upgrade to Firebase 9.6.3;
- Reduce overall bundle size;
- IE11 support has been deprecated.

#[1.5.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.5) (2022-01-13)
###📃 release notes
- Upgrade to Angular 11.2.14;
- Upgrade to Typescript 4;
- Support for IE9, IE10, and IE mobile has been removed.

#[1.4.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.4) (2022-01-11)
###📃 release notes
- Upgrade to Angular 10.2.5.

#[1.3.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.3) (2021-07-29)
###📃 release notes
- Add horizontal gestures to navigate the profile experience.
- Add horizontal gestures to navigate the profile posts.

#[1.2.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.2) (2020-06-15)
###📃 release notes
- Add to the header an icon for downloading the resume as PDF file;
- Add the company logo to the Experience section;
- Improv application text's readability.

#[1.1.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.1) (2020-06-07)
###📃 release notes
- Solve `websocket-extensions` dependency vulnerability;
- Improve the README instructions;
- Add Google Analytics integration to the repository using ga-beacon;
- Update the footer section to provide the GitHub fork link;
- Create the initial Wiki documentation;
- Improve the skill icons nomenclature, making it generic;
- Remove deprecated test files ( The new Unit and Integration tests are in development ) ;
- Remove CDN assets from the master branch, allowing offline development.

#[1.0.0](https://github.com/guilhermeborgesbastos/live-resume/releases/tag/v1.0) (2020-05-22)
###📃 Initial release
- The Angular application is ready for production using ES6. The ES5 release can be found in the es5 branch.
