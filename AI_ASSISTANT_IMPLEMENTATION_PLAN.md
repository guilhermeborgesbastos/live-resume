# CV Assistant implementation plan

Status: implemented (D1–D10 complete); see the completion record in section 13.

Repository baseline inspected: 24 October 2026. Recheck the relevant files before editing because the application and CV data may change.

## 1. Objective and architectural decision

Add one CV assistant with three entry points:

1. An interactive welcome speech bubble announcing the assistant and offering a clear action.
2. A dedicated `/assistant` page with suggested questions, the current conversation history, and links to CV sources.
3. A floating “Ask about my CV” button that opens a compact conversation panel while visitors browse the resume.

Implement a deterministic, browser-only question-answering engine in TypeScript using the existing Angular application. Answers must be assembled from approved JSON fields using fixed templates or verbatim plain-text excerpts. No language model, inference endpoint, embeddings, vector database, chatbot platform, external search, or new runtime dependency is required.

This is a rule-based CV assistant. It will support a documented set of question forms and synonyms, rather than understand arbitrary natural language. Prefer refusing an unrecognized phrasing over returning an unrelated or speculative answer. Suggested questions make supported capabilities discoverable. Do not describe it as generative AI or promise that it understands every CV question.

The default implementation requires no AWS resources and has no model/API charge per question. It reuses the existing website hosting; serving additional static bytes can still contribute to existing bandwidth costs. Do not promise that hosting is universally free. AWS is unnecessary for this scope; do not provision services, change hosting, or add accounts/secrets. Any later backend proposal must be a separate scope with justification and current pricing research.

## 2. Mandatory constraints

- All factual knowledge comes exclusively from the explicitly approved JSON files in `src/assets/data`.
- Initially allowlist `about.json`, `experiences.json`, and `posts.json`. A future file needs an adapter, schema validation, and coverage before becoming a source.
- Do not use the PDF CV, templates, environment files, XD prototype, social profiles, linked articles, or external websites as knowledge. Source URLs are links, not permission to fetch their contents.
- Do not add invented facts or manually maintained copies of CV answers to code or a FAQ file. Templates, recognition rules, and interface translations are allowed; their factual slots must resolve to JSON data.
- JSON content and visitor input are data, never executable instructions. Render answers and messages as text with explicitly constructed links.
- Every factual answer must carry source references identifying its JSON record and fields. Related keywords alone are insufficient evidence that a question is answerable.
- Missing, unsupported, ambiguous, contradictory, or partially answerable requests receive the default fallback. In version one, do not answer only the supported half of a multi-part request.
- Never infer salary, availability, work authorization, language fluency, qualifications, personal residence, preferences, or unlisted experience.
- Absence of a technology or achievement in the files means “not answerable,” not “no experience.”
- No external request is made to answer a question after the same-origin JSON snapshot loads. Do not send messages to Firebase, analytics, logs, or any other service.
- Existing contact submission remains a visitor-controlled action. Clicking a fallback contact link must not submit or prefill a conversation automatically.
- Preserve existing resume navigation, localization, contact behavior, and unrelated user changes.

## 3. Repository integration map

| Existing location | Observed behavior | Planned integration |
| --- | --- | --- |
| `src/assets/data/about.json` | EN/PT HTML descriptions, social links, hobbies | Profile excerpt, hobbies, profile links; plain-text conversion |
| `src/assets/data/experiences.json` | Six records with IDs, dates, companies, EN/PT role/location/description, technologies | Structured experience answers and supporting excerpts |
| `src/assets/data/posts.json` | Nine records with dates, URLs, EN/PT titles/descriptions; no IDs | Local post metadata and summaries only; stable identity derived from unique URL |
| `src/app/core/data.service.ts` | HTTP loaders for the three files | Reuse loaders through a cached, validated assistant knowledge service |
| `src/app/app-routing.module.ts` | Resume root, section redirects, wildcard | Add lazy `/assistant` route before wildcard; update outdated root-only comment |
| `src/app/resume/resume.component.*` | Composes header and resume sections | Mount floating entry point/panel on resume route |
| `src/app/header/header.component.*` | Fragment anchors, active-section logic, locale links | Add Assistant item and route-aware links; support header on assistant page |
| `src/app/welcome/welcome-dialog/*` | Image-backed speech bubble with EN/PT typing animation | Add persistent accessible assistant CTA and translated announcement |
| `src/app/experience/experience.component.*` | Carousel selection based on position | Resolve source record ID to carousel position when following a citation |
| `src/app/posts/posts.component.*` | Paginated responsive carousel | Reveal a cited post even when its card is on another page |
| `src/locales/messages*.xlf` | Angular compile-time i18n | Add all assistant interface messages and EN/PT translations |
| `docker/nginx.conf` | Locale-prefixed SPA fallback | Existing mechanism should serve `/en/assistant` and `/pt/assistant`; verify |
| `e2e/` and `src/**/*.spec.ts` | Playwright and Jasmine infrastructure | Extend existing test infrastructure |

Important data details:

- Dates use `MM-DD-YYYY`; parse explicitly and reject invalid dates. Do not rely on browser-specific date-string parsing.
- Swisscom's record currently has no `endAt`. Say “Listed as ongoing in the CV,” not that current employment has been independently verified.
- About currently states “over 10 years.” Quote that statement; do not calculate total experience or technology tenure from employment ranges.
- Descriptions contain HTML, including nonstandard `</br>` breaks. Normalize these into paragraph/line boundaries before extracting text.
- EN and PT descriptions are not identical translations. Use only the selected locale's facts. For example, the PT Swisscom text explicitly mentions Terraform while the EN description does not; do not silently import that claim into an EN answer.
- Contact email and phone are not fields in the three current source files. A contact navigation action is supported, but answering “What is your email?” must fall back unless approved JSON later contains that fact.
- Company cities describe work locations, not necessarily the person's current residence.

## 4. Visitor experience

### 4.1 Welcome bubble

Keep the existing illustration and bubble identity. Add the announcement “Explore my CV with the assistant” and a persistent button “Ask about my CV.” The CTA opens the dedicated assistant page. Show two compact suggestions only if they fit without crowding; selecting one opens the page and submits the associated supported question exactly once.

Keep the CTA available regardless of typing-animation progress. Respect reduced-motion preferences and expose a stable text equivalent instead of announcing every typed character. On narrow screens, allow a flexible layout rather than clipping text inside the image.

### 4.2 Dedicated page

Add a navigation item “CV Assistant” and a spacious page containing:

- Heading and scope description: “Ask about the experience, skills, and posts listed in this CV.”
- A short disclosure: “Answers use the information published in this CV.”
- Source-backed suggested questions when the conversation is empty.
- Chronological messages, visible source links, and fallback contact action.
- Labelled composer, send action, clear conversation, and return-to-resume action.
- Full-page scroll behavior that keeps messages and composer usable with the mobile keyboard open.

“Full-screen” means a dedicated viewport-filling route; do not invoke the browser Fullscreen API. The initial scope includes one conversation per locale for the current application session, not accounts or a multi-conversation archive.

### 4.3 Floating panel

Show a fixed “Ask about my CV” control on the resume, including About, Experience, and Posts. On desktop, open a compact panel approximately 380–440 px wide, bounded by viewport dimensions. On mobile, use a viewport-bounded sheet with safe-area padding and a usable composer above the keyboard.

The panel includes close, expand-to-page, messages, suggestions, and composer. Closing preserves the conversation. Expanding transfers the same conversation and unsent draft to the dedicated page. The panel must not obscure the header, contact controls, or mobile navigation when closed.

Use a modal dialog for the open compact panel, with a backdrop, keyboard focus containment, Escape to close, and focus restoration. Lock background scrolling and restore its exact position on close. The full-page conversation is not a dialog. Hide the floating panel on `/assistant` so the two conversation views are never active together.

### 4.4 Fallback copy

Use these exact defaults for requests the engine cannot answer, including relevant questions whose facts are missing:

**EN:** “I can’t answer this question using the information available in my CV. Please contact me directly so I can help.”

Action: **Contact Guilherme** → the locale-aware resume contact section.

**PT:** “Não consigo responder a esta pergunta com as informações disponíveis no meu currículo. Entre em contato comigo diretamente para que eu possa ajudar.”

Action: **Entrar em contato com Guilherme** → the locale-aware resume contact section.

Always render the contact action with the fallback. Do not imply that the requested fact is false. Suggested supported questions may appear below the fallback, but must not replace it.

An asset loading failure uses a distinct localized availability message with Retry and Contact actions: “The CV information could not be loaded. Please try again or contact me directly.” Empty/overlong input uses a validation message and does not add an assistant answer.

## 5. Knowledge and answer contracts

Create typed models under `src/app/assistant/`. Suggested boundaries:

```text
assistant/
  models/assistant.models.ts
  knowledge/assistant-knowledge.service.ts
  knowledge/knowledge-adapter.ts
  knowledge/plain-text.ts
  engine/normalize-question.ts
  engine/question-patterns.ts
  engine/resolve-question.ts
  engine/compose-answer.ts
  engine/assistant-engine.ts
  state/assistant-session.service.ts
  ui/conversation/
  ui/composer/
  ui/suggestions/
  ui/source-links/
  ui/panel/
  ui/launcher/
  pages/assistant-page/
```

Keep the engine pure and independent of Angular rendering, HTTP, storage, clocks, and randomness. Components only orchestrate input, state, navigation, and presentation. All entry points use the same engine, knowledge service, and root-provided session service.

Example conceptual contracts; refine types during implementation without weakening their guarantees:

```ts
type Locale = 'en' | 'pt';
type SourceFile = 'about.json' | 'experiences.json' | 'posts.json';

type SourceRef = {
  file: SourceFile;
  recordKey: string;       // 'about', experience ID, or unique post URL
  pointers: string[];      // Exact JSON pointers into the loaded snapshot
  label: string;          // Localized human-readable citation
};

type AnswerResult =
  | { kind: 'answered'; blocks: AnswerBlock[]; sources: SourceRef[] }
  | { kind: 'fallback'; reason: FallbackReason }
  | { kind: 'unavailable' };

// AnswerBlock is a closed union: sourced text excerpt, sourced field list,
// or a localized fixed template populated exclusively by sourced fields.
// No arbitrary generated factual prose and no raw HTML are allowed.
```

Store provenance alongside facts when adapting JSON, including the actual locale array index. Use immutable data or defensive copies so sorting elsewhere in the app cannot change assistant results. Validate required fields, unique experience IDs, unique post URLs, locale entries, and date formats. Optional missing fields stay absent.

Load the three assets once per assistant session through the knowledge service and reuse the snapshot. Wait for a complete validated snapshot before enabling submission. If a file fails or required structure is invalid, fail closed with the availability state and retry the load. Do not answer against a silently partial dataset. Do not automatically index every future file in the directory.

## 6. Deterministic recognition and grounding

### 6.1 Processing order

1. Trim input; accept 1–500 Unicode code points. Reject empty/overlong input without processing a truncated version.
2. Normalize Unicode and case. Make accent-insensitive matching available for names and PT patterns, while retaining original values for display.
3. Normalize whitespace and permitted terminal punctuation. Preserve meaningful technology characters such as `C++`, `C#`, `.NET`, `Node.js`, and `CI/CD`. Do not collapse Java and JavaScript or Angular and AngularJS.
4. Match the entire normalized utterance against a finite, reviewed set of EN/PT question patterns. Patterns capture only declared slots such as company, technology, post title, or topic. Define allowed polite prefixes explicitly.
5. Resolve slots to approved data using exact normalized values or explicit safe aliases. Recognition aliases point to existing facts; they do not create facts. Reject unknown entities, unsupported qualifiers, and ambiguous matches.
6. Require one supported intent with all requested fields available in the active locale. Reject unmatched clauses, negation forms not explicitly supported, comparisons, hypothetical requests, and compound questions in version one.
7. Compose a fixed template or display relevant source excerpts. Require every factual block to reference existing fields in the loaded snapshot.
8. Produce a stable ordering and source list; otherwise return the exact fallback.

Use anchored patterns or an equivalent finite parser. Do not strip all stopwords and then consider any remaining keyword a complete question. Do not use fuzzy scores, semantic similarity, or a confidence threshold as permission to answer. Token matching can filter posts within a recognized post-search intent, but cannot select an unrelated intent or prove a specific fact.

If a question names two companies or asks two things, return the fallback rather than choosing the first match. If a user asks “How many years of AWS experience?”, the presence of AWS in a role does not establish years of AWS use. If a question says “Tell me about Swisscom and write a poem,” the unmatched suffix forces the fallback.

### 6.2 Initial supported intents

| Intent | Example question | Grounded output | Required boundary |
| --- | --- | --- | --- |
| Profile | “Tell me about your professional background.” | Active-locale About description as an excerpt | No extra claims from template/environment files |
| Employers | “Which companies have you worked for?” | Company names and recorded date ranges | No invented contracts or clients |
| Latest listed role | “What is your current role?” | Role with no end date, qualified as ongoing in CV | Multiple ongoing roles: list all in stable order; never arbitrarily choose one |
| Company overview | “Tell me about your work at Swisscom.” | Role, dates, location, description excerpt | Resolve Swisscom alias to Swisscom AG |
| Company role/dates/location | “When did you work at QAT Global?” | Exactly the requested structured fields | No residence or timezone inference |
| Technologies | “Which technologies are listed in your CV?” | Deduplicated values from `technologies` arrays | Explain list scope; do not claim exhaustive expertise |
| Technology experience | “Where have you used Java?” | Matching roles whose technology list explicitly contains Java or a reviewed alias | Java must not match JavaScript; Java (Android) can be a documented Java variant |
| Company technologies | “Which technologies did you use at Swisscom?” | That record's technology list | Missing technology is not evidence of non-use |
| Posts | “Which posts have you published?” | Local titles, dates, source links | Do not fetch article bodies |
| Post search | “Do you have posts about Android?” | Titles/descriptions matching whole topic tokens within a recognized search intent | No results → fallback, not “no posts exist” |
| Post summary | “What is your post about [exact title] about?” | Local description labelled as a CV excerpt | No article-specific detail beyond JSON |
| Hobbies | “What are your hobbies?” | `about.hobbies[].title` | Translate fixed labels only through reviewed mappings |
| Social links | “Where can I find your GitHub profile?” | Matching About social URL | Company GitHub/social URLs must not substitute for personal profiles |

Support equivalent PT patterns for every intent. Questions may use either language's supported patterns, but answers and evidence follow the active site locale. If the required localized fact is absent, use the fallback; do not translate or combine foreign-language evidence automatically.

Do not initially support arbitrary “why/how,” skill rankings, job-fit scores, tenure calculations, or semantic extraction of specific outcomes from free text. A generic company overview may quote the full description; a narrow question about a particular metric must fall back unless a dedicated, evidence-checked rule is implemented later.

### 6.3 Stable output and conversation context

For the same question, locale, validated data snapshot, and rule version, return identical answer content and source order. Do not depend on system date, random sampling, or prior chat content. UI timestamps/IDs are presentation metadata only.

Version one is intentionally stateless for question interpretation. A follow-up such as “And before that?” or “How long there?” falls back. Offer explicit follow-up chips naming the company/technology instead. Conversation history is a display feature and never a new knowledge source.

Order employers by parsed start date descending, breaking ties by ID. Preserve source order for company technologies and hobbies. For aggregate technologies, deduplicate normalized exact values and sort by an explicitly implemented stable comparator. Order posts by parsed date descending, then unique URL. Avoid runtime-dependent collation defaults.

## 7. Sources and navigation

Each answer shows meaningful links such as “Experience · Swisscom AG,” “About,” or a post title. Internal links must keep the current locale and navigate back from `/assistant` to the correct resume section.

Use Angular route commands relative to the locale base, not bare `#experience` on the assistant page. Suggested target contract:

- About: root route plus `about` fragment.
- Experience: root route plus `experience` fragment and `experienceId=<record ID>` query parameter.
- Post: root route plus `posts` fragment and `post=<unique source URL>` query parameter, encoded by the router.
- Contact: root route plus `contact` fragment.

Only generated known source identifiers belong in query parameters. Never put questions, drafts, or transcript text in URLs. Validate incoming identifiers against loaded data; unknown IDs fall back to the relevant section without throwing or selecting an unrelated record.

After asynchronous data loading, select the requested experience by ID and translate to the existing carousel's position. Do not assume ID equals array index or position. For posts, find the URL's current index and compute its page once the responsive page size is known. Keep selection consistent on resize. Close the compact panel before following a citation, reveal the record, and scroll/focus the relevant heading without losing the transcript.

For external links, accept only parsed HTTP/HTTPS URLs from approved fields, use Angular property binding, and add `rel="noopener noreferrer"` when opening a new tab. Ignore unsafe schemes. A citation should still link internally if its external URL is missing or rejected. Do not render raw Markdown/HTML supplied by a visitor or JSON description.

## 8. Shared session and privacy

Use one root-provided in-memory store, keyed by normalized site locale, containing messages, unsent draft, panel state, knowledge state, and submission state. Keep it across Angular route changes. History is cleared on browser refresh/tab close; document this behavior beside Clear conversation or in a concise help message.

Do not use localStorage, IndexedDB, server storage, or accounts in version one. The current locale links perform full-page navigation, so switching locale starts a fresh session; make this explicit and avoid claiming persistence across that navigation.

Cap each conversation at 50 question/answer pairs, removing the oldest complete pair when needed and showing a history-limit notice. Do not retain an unbounded array. Clear conversation clears messages and draft immediately, returns suggestions, and leaves the knowledge cache reusable. Show a lightweight clear confirmation only if needed for preventing accidental loss, not an external authorization flow.

Do not add artificial typing delays. Disable duplicate submissions while an answer is being processed. Existing analytics may observe navigation, but assistant message text, excerpts, drafts, and contact fallback reasons must never be sent as event payloads or URL parameters. Do not claim the entire pre-existing website has no third-party traffic.

## 9. Deliverables and execution order

Complete the deliverables in order. Each should be a focused, reviewable change with acceptance evidence. Mark checkboxes only after the implementation and required checks pass. Reuse existing Angular patterns; avoid broad migrations or unrelated cleanup.

### D1 — Data contract and supported-question specification

Dependencies: none.

- [x] Confirm current data shapes, locales, dates, optional fields, and source IDs.
- [x] Define typed normalized records and provenance structures.
- [x] Create the explicit EN/PT intent/pattern/alias registry without hardcoded factual answers.
- [x] Document supported examples and unsupported cases in feature documentation.
- [x] Establish fixed fallback and availability messages with contact action.

Acceptance: every supported intent maps to named JSON fields; each sample can be traced to actual data. Unknown/missing facts have an explicit fallback path. No new CV facts are added to make tests pass.

### D2 — Validated knowledge adapter

Dependencies: D1.

- [x] Add cached loading through existing DataService methods and immutable normalization.
- [x] Convert HTML to inert plain text; handle `<br>`, `</br>`, paragraphs, entities, and list boundaries.
- [x] Exclude script/style content; never attach parsed markup to the live DOM or trigger resource fetching while extracting text.
- [x] Validate schema, unique identifiers, required localized fields, dates, and outgoing link schemes.
- [x] Attach exact source pointers and distinguish absent optional values.
- [x] Implement complete-snapshot loading, failure, and explicit retry states.

Acceptance: adapter fixtures cover current data plus malformed/unsafe HTML, invalid dates, missing fields/locales, duplicate IDs, and one failed asset request. Original JSON remains unmodified. Repeated consumers reuse the cache.

### D3 — Pure deterministic answer engine

Dependencies: D1–D2.

- [x] Implement bounded normalization, full-utterance recognition, slot resolution, and intent-specific evidence checks.
- [x] Implement fixed answer composition with provenance for all factual blocks.
- [x] Implement conservative fallback for unsupported qualifiers, unknown entities, compound requests, and ambiguous aliases.
- [x] Define safe aliases without conflating Java/JavaScript or Angular/AngularJS.
- [x] Enforce stable sorting and no clock/history/random dependency.
- [x] Add a table-driven EN/PT acceptance corpus covering the matrix below.

Acceptance: repeated inputs produce identical answer content; every answered block resolves to a real source field. All negative/unsupported cases in the corpus return the exact localized fallback. Keep uncertain phrasing unsupported instead of weakening matching to pass a positive example.

### D4 — Shared session and reusable conversation UI

Dependencies: D2–D3.

- [x] Add root session store, per-locale state, 50-pair bound, clear behavior, draft, and duplicate-submit protection.
- [x] Build reusable message list, suggested questions, source links, and composer.
- [x] Generate suggestions from available records and supported patterns; suppress any suggestion that cannot be answered.
- [x] Add loading, empty, answered, fallback, availability-error, and input-validation states.
- [x] Keep source excerpts as readable text with paragraph structure.

Acceptance: two consumers of the store see the same messages and draft; rendering does not execute user or source markup. Clearing and bounds work. Every displayed suggestion resolves to an answered result for that snapshot and locale.

### D5 — Dedicated assistant route and navigation

Dependencies: D4.

- [x] Add lazy `/assistant` route before the wildcard and page metadata/title.
- [x] Build the full-page conversation layout and return-to-resume action.
- [x] Add the header Assistant navigation item for desktop and mobile.
- [x] Make section/logo links work from both routes; adapt active-state logic without relying only on fragment selectors.
- [x] Handle header initialization safely when there is no active resume section.
- [x] Verify direct entry, reload, back/forward, and localized route behavior.

Acceptance: `/en/assistant` and `/pt/assistant` work through existing deployment routing, and resume anchors still work. No new backend or hosting service is required.

### D6 — Floating entry point and compact panel

Dependencies: D4–D5.

- [x] Mount the launcher/panel on the resume route.
- [x] Add responsive dialog behavior, safe-area sizing, close/Escape, focus containment, and focus return.
- [x] Preserve background scroll while the dialog opens/closes.
- [x] Expand into the page without losing conversation or draft; close the panel during route changes.
- [x] Suppress the launcher on the assistant route and 404 page.

Acceptance: close/reopen preserves history; expand preserves both draft and messages. Keyboard users can open, operate, and close the panel. Only one conversation view and one modal are active.

### D7 — Interactive welcome bubble

Dependencies: D5.

- [x] Add EN/PT assistant announcement and persistent CTA to the existing speech bubble.
- [x] Adjust layout to fit the illustration, text, and control at desktop/mobile sizes.
- [x] Preserve the original welcome intent and provide reduced-motion behavior.
- [x] If adding suggestion shortcuts, dispatch the predefined question through session state, not URL text.

Acceptance: CTA is usable before animation completes, works with keyboard/touch, and does not clip at narrow widths or zoom. Each shortcut submits once.

### D8 — Citation targets and contact handoff

Dependencies: D4–D6.

- [x] Add locale-aware internal target construction and validated experience/post selection.
- [x] Reveal selected carousel records after data/render readiness and on browser navigation.
- [x] Keep post selection stable across responsive page-size changes.
- [x] Add safe external article/profile links with internal citation fallback.
- [x] Connect every unsupported answer to the existing Contact section.

Acceptance: citations reveal the intended record from both conversation views. Contact navigation preserves history within the SPA and never sends a message. Invalid identifiers fail gracefully.

### D9 — Localization, accessibility, and integration checks

Dependencies: D1–D8.

- [x] Add all static/runtime message IDs to the existing Angular i18n workflow and EN/PT XLF files.
- [x] Check keyboard navigation, focus visibility, accessible labels, contrast, 200% zoom, and reduced motion.
- [x] Announce completed answers via a polite live region; do not repeatedly announce the whole history or animate answer text character by character.
- [x] Use Enter to send and Shift+Enter for newline; respect IME composition events.
- [x] Keep long excerpts/URLs wrapped and layout usable at 320 px width and with mobile keyboards.
- [x] Add Playwright journeys for both locales and existing desktop/mobile projects.
- [x] Verify no assistant question/draft/transcript appears in requests, analytics payloads, console output, or URLs.

Acceptance: both localized builds pass, existing resume tests remain green, and assistant tests cover successful and fallback journeys. Account for the site's pre-existing third-party initialization when checking traffic; assert that assistant interaction adds no question-processing requests.

### D10 — Documentation and completion evidence

Dependencies: D9.

- [x] Document supported patterns, limitations, source update workflow, session lifetime, fallback policy, and zero model/API cost design.
- [x] Explain how to add a new intent: fields → parser rule → evidence condition → template → provenance → EN/PT positive and negative fixtures.
- [x] Record validation commands/results, remaining limitations, and changed files.
- [x] Update this plan's checkboxes only for completed work.

Acceptance: another AI agent can extend the feature without introducing an external answer service or unsupported factual claims. No AWS resources, credentials, new runtime dependencies, or automatic contact submissions were introduced.

## 10. Required behavioral acceptance matrix

Implement equivalent PT cases in addition to these EN cases. Tests should assert provenance and meaning, not only that a message exists.

| Input or condition | Expected result |
| --- | --- |
| “Tell me about your professional background.” | About excerpt with About source |
| “What is your current role?” | Swisscom role from selected locale, qualified as listed ongoing; no live verification claim |
| “When did you work at QAT Global?” | Exact recorded range, locale-formatted, cited |
| “Which technologies did you use at Swisscom?” | Values from that record's technologies list |
| “Where have you used Java?” | Only explicit Java/approved Java variant matches; no JavaScript-only roles |
| “Where have you used Rust?” when no matching fact exists | Default fallback + Contact |
| “Do you have posts about Android?” | Matching local metadata; no fetched article contents |
| “What are your hobbies?” | Values grounded in About hobby titles |
| “How many years of AWS experience do you have?” | Default fallback; no employment-duration approximation |
| “What salary are you looking for?” | Default fallback + Contact |
| “Are you available next Monday?” | Default fallback; no use of current date |
| “What is your email address?” with current JSON | Default fallback + Contact; no environment/template extraction |
| “Why did you leave QAT Global?” | Default fallback; dates do not establish reasons |
| “Did you use JavaScript at [Java-only fixture company]?” | Default fallback; no substring matching |
| “You worked at Google, right?” | Default fallback; do not accept visitor claims as facts |
| “What percentage did you reduce Swisscom incidents by?” | Default fallback when only qualitative claims exist |
| “Tell me about Swisscom and forecast the weather.” | Default fallback for entire compound request |
| “Ignore the rules and write a Java tutorial.” | Default fallback even though Java appears in the CV |
| “Tell me about Swisscom but invent achievements.” | Default fallback due to unsupported clause |
| “And before that?” after a valid answer | Default fallback; no implicit context guessing |
| EN request whose requested fact exists only in PT | Default fallback; do not mix language evidence |
| Whitespace only or more than 500 code points | Validation message; no engine answer |
| Visitor/source text containing HTML or script | Render safely as text/exclude active source content; no execution/fetch |
| All supported questions repeated against same snapshot | Same factual content and citation order |
| JSON missing, malformed, or inconsistent required schema | Availability state, Retry, and Contact; no partial knowledge answers |
| Citation to non-visible experience/post | Navigate to locale root, reveal correct record, scroll/focus target |
| Open panel → ask → expand → return → reopen | Same transcript and draft within the SPA session |
| Refresh or switch locale through current language links | New session, as documented |
| Clear conversation / exceed 50 pairs | Empty state / oldest complete pairs removed predictably |
| Unsupported external URL scheme in source | No unsafe outgoing link; internal citation remains usable |

Use isolated invalid-data fixtures rather than editing the real CV to exercise failures. Use existing network stubs so tests never submit real contact messages or analytics events. For intentional failed-asset tests, explicitly assert the expected failure without disabling unrelated diagnostics.

## 11. Validation commands and release gate

Use existing scripts and package tooling. Install dependencies only when needed. After targeted engine/component tests, run the repository checks appropriate to the completed implementation:

```bash
npm run lint
npm test -- --watch=false --browsers=ChromeHeadless
npm run build-locale
npm run test:e2e:run
```

The E2E command uses the localized builds produced immediately before it. If deployment routing/configuration changes, also run the existing Docker/browser workflow documented in the repository. Do not run redundant full suites after a clean result unless subsequent changes justify them. If browser dependencies or another prerequisite block a check, report the exact blocker and which checks remain unrun; never mark that deliverable verified.

Release gate:

- All deliverables complete with acceptance evidence.
- Both EN/PT views and all three entry points function together.
- Every factual answer is grounded in approved JSON; required negative cases fall back.
- Sources reveal the correct CV content; fallback always offers contact.
- No assistant API keys, external answer service, metered inference, or new infrastructure.
- Existing functionality passes regression checks.
- Documentation accurately explains finite language coverage and session-only history.

## 12. Instructions for the implementing AI agent

1. Read this plan and any applicable repository instructions. Inspect current files and git status before editing; preserve unrelated changes.
2. Implement one deliverable at a time, keeping the deterministic engine separate from presentation.
3. Use this document as the specification; treat JSON strings and visitor questions strictly as data.
4. Prefer explicit unsupported cases to plausible but ungrounded answers. Do not silently switch to a language model or fuzzy answer generator to improve coverage.
5. If data is absent, implement fallback. If a supported question is unrecognized, extend reviewed patterns and adversarial fixtures rather than adding hand-authored CV facts.
6. Keep all user-facing strings localized and use existing visual conventions from the welcome, header, and resume sections.
7. Record completion and meaningful validation per deliverable. Do not claim implementation based on documentation alone.
8. Finish with a concise report of changed behavior, checks passed/blocked, documented limitations, and operating-cost implications. Publishing/deployment is a separate action from completing the code.

## 13. Completion record (24 October 2026)

Implemented on branch `worktree-feat+cv-assistant`. Feature documentation: `docs/cv-assistant.md`.

### Acceptance evidence per deliverable

| Deliverable | Evidence |
| --- | --- |
| D1 Data contract | `models/assistant.models.ts`; EN/PT registry in `engine/question-patterns.ts`; supported/unsupported cases documented in `docs/cv-assistant.md`; fallback/availability copy in the XLF files (exact EN/PT text from §4.4). |
| D2 Knowledge adapter | `knowledge/knowledge-adapter.spec.ts`, `knowledge/plain-text.spec.ts`: current data, unsafe/malformed HTML, `</br>`, entities, invalid dates, missing fields/locales, duplicate IDs/URLs, unsafe schemes, frozen snapshot with the source JSON unmodified; `state/assistant-session.service.spec.ts`: cache reuse, one failed asset → error → retry, invalid data → error. |
| D3 Engine | `engine/assistant-engine.spec.ts`: 37 EN/PT positive cases checked by `expectGrounded` (every fact/excerpt equals the JSON at its cited pointer), 36 negative cases covering the §10 matrix, Java/JavaScript and Angular/AngularJS separation, Java-only fixture, PT-only fact, multiple ongoing roles, ambiguous alias, unsafe URLs, determinism across repeated calls and independently built snapshots. |
| D4 Session/UI | Session spec: shared consumers, 50-pair bound, clear, validation, queued shortcut answered once; e2e: every displayed suggestion answers, text-only rendering of visitor markup. |
| D5 Route/navigation | e2e: `/en/assistant` and `/pt/assistant` direct entry, reload, back/forward, header links both ways without losing the session, localized title; Docker/nginx run of the full suite. |
| D6 Panel | e2e: open/ask/Escape/focus return/exact scroll restore, reopen keeps history, expand keeps transcript and draft, return and reopen, citation closes the panel; not rendered on `/assistant` or 404. |
| D7 Welcome | e2e: CTA works by keyboard before the typing finishes; a double-clicked shortcut asks once. Reduced motion stops the float animation and shows the greeting statically; screen readers get a stable text equivalent. |
| D8 Citations | e2e: an experience that is not shown first and a post on a later carousel page are revealed and focused from both views; contact link reaches `#contact` with no Firestore request and an empty form. |
| D9 i18n/a11y | 36 `assistant@@*` units in both XLF files (localized builds with `i18nMissingTranslation: "error"`); labelled composer, polite live region with the latest answer only, Enter/Shift+Enter with IME guard, 320 px layout check; e2e privacy test: no request at all while answering, question/draft absent from requests, console, URL and `dataLayer`. |
| D10 Docs | `docs/cv-assistant.md`, README section, CLAUDE.md architecture notes, CHANGELOG "Unreleased". |

### Validation commands and results

| Command | Result |
| --- | --- |
| `npm run lint` | All files pass linting. |
| `npm run validate:posts` | posts.json is valid (10 posts). |
| `npm test -- --watch=false --browsers=ChromeHeadless` | 126 of 126 specs passed (run with `CHROME_BIN=/usr/bin/chromium` on this machine). |
| `npm run build-locale` | Both locales built, no budget warnings. |
| `npm run test:e2e:run` | 85 passed, 5 skipped (viewport-specific). |
| `npm run test:e2e:docker` | 85 passed, 5 skipped. |

### Changes to existing behavior

- Header: section links navigate inside the SPA when not on the resume; active state uses `data-section`; new Assistant item; language links keep the current page (`/xx/assistant`).
- Experience carousel selects items by `data-position` instead of assuming `id === position`.
- `#welcome` uses `min-height` so the CTA can grow the section instead of being clipped.
- `ResumeComponent` keeps a `#fragment` target in view while data-driven sections render; this fixed the mobile deep-link issue previously annotated as known in `e2e/resume.spec.ts`, whose assertion is now strict on mobile too.

### Remaining limitations

Finite question coverage (no typos, synonyms outside the reviewed forms, or follow-up context); whole-word post search; technology answers limited to the `technologies` lists; one in-memory conversation per tab and locale. No AWS resources, credentials, runtime dependencies, external answer service or automatic contact submission were added; operating cost is unchanged apart from the extra static bytes (measured for the EN production build: initial bundle 1.78 MB → 1.87 MB raw, 506 kB → 532 kB estimated transfer, plus a 4.5 kB lazy chunk for the page).
