# CV Assistant

A rule-based assistant that answers a documented set of questions about the CV, in English and Portuguese. It runs entirely in the browser: answers are built from `src/assets/data/about.json`, `experiences.json` and `posts.json` with fixed templates or verbatim excerpts. There is no language model, inference endpoint, embedding, search service or new runtime dependency, so there is no per-question model or API cost and no AWS resource; the assistant only adds static bytes to the existing hosting.

It recognizes the question forms listed below and their close variants. It does not understand arbitrary language, and anything outside those forms gets the [fallback](#fallback-policy) instead of a guess.

- [Where it appears](#where-it-appears)
- [Supported questions](#supported-questions)
- [What it will not answer](#what-it-will-not-answer)
- [Fallback policy](#fallback-policy)
- [Sources and citations](#sources-and-citations)
- [Session lifetime and privacy](#session-lifetime-and-privacy)
- [Updating the CV data](#updating-the-cv-data)
- [Adding a new intent](#adding-a-new-intent)
- [Code map](#code-map)
- [Testing](#testing)
- [Limitations](#limitations)

## Where it appears

| Entry point | Where | Behavior |
| --- | --- | --- |
| Welcome bubble | Under the speech bubble in `#welcome` | "Explore my CV with the assistant" and an **Ask about my CV** link to `/assistant`, usable before the typing animation finishes. Wider screens also show two shortcut questions (current role, a post topic); a shortcut asks its question once through the shared session (never through the URL) and opens the page. |
| `/assistant` page | `/en/assistant`, `/pt/assistant` (lazy route, header item **CV Assistant** / **Assistente**) | Full-page conversation: scope and disclosure, starter suggestions, transcript, composer, **Clear conversation**, **Back to the resume**. Not a dialog. |
| Floating panel | Fixed **Ask about my CV** button on the resume while About, Experience or Posts is the active section | A modal `<dialog>` (desktop: about 420 px wide; phones: a bottom sheet above the keyboard with safe-area padding). Escape or the backdrop closes it, focus returns to the button and the page scroll position is restored. **Expand** carries the conversation and the unsent draft to `/assistant`. Not rendered on `/assistant` or the 404 page. |

All three use the same engine, data snapshot and session (`AssistantSessionService`).

## Supported questions

Patterns match the whole question after folding case, accents and typographic quotes and dropping terminal `?`, `!`, `.`. Polite openings ("please", "can you tell me", "por favor", "você pode me dizer", ...) and a closing ", please"/", por favor" are allowed. Questions may be asked with either language's forms; the answer always uses the site's locale and that locale's data. The complete list of forms is in [`question-patterns.ts`](../src/app/assistant/engine/question-patterns.ts).

| Intent | Example (EN) | Example (PT) | Answer, from |
| --- | --- | --- | --- |
| Profile | Tell me about your professional background. | Fale sobre sua trajetória profissional. | About description excerpt |
| Employers | Which companies have you worked for? | Em quais empresas você trabalhou? | Company names + recorded date ranges, newest first |
| Current role | What is your current role? | Qual é o seu cargo atual? | Every role without `endAt`, "listed as ongoing in my CV" |
| Company overview | Tell me about your work at Swisscom. | Fale sobre o seu trabalho na Swisscom. | Role, period, work location, description excerpt |
| Company role | What was your role at QAT Global? | Qual era o seu cargo na QAT Global? | `role` |
| Company dates | When did you work at QAT Global? | Quando você trabalhou na QAT Global? | `startAt`/`endAt` |
| Company location | In which city did you work at Deevo? | Em qual cidade você trabalhou na Deevo? | `city`, `country` (a work location, not a residence) |
| Technologies | Which technologies are listed in your CV? | Quais tecnologias estão listadas no seu currículo? | Deduplicated `technologies` values, with a note that the list is not exhaustive |
| Technology experience | Where have you used Java? | Onde você já usou Java? | Roles whose `technologies` list the value |
| Company technologies | Which technologies did you use at Swisscom? | Quais tecnologias você usou na Swisscom? | That record's `technologies`, in source order |
| Technology at company | Did you use JavaScript at Swisscom? | Você usou JavaScript na Swisscom? | "Yes" only when that record lists it |
| Posts | Which posts have you published? | Quais artigos você publicou? | Titles and dates, newest first |
| Post search | Do you have posts about Android? | Você tem artigos sobre Android? | Posts whose title or summary contains every searched word |
| Post summary | What is your post "The anti-traversing 2D Array formula" about? | Sobre o que é o artigo "…"? | The post's description, labelled as the CV summary |
| Hobbies | What are your hobbies? | Quais são os seus hobbies? | `about.hobbies[].title` (PT labels via a reviewed translation table) |
| Social link | Where can I find your GitHub profile? | Qual é o seu GitHub? | The matching `about.medias` URL |
| Social links | What are your social media profiles? | Quais são suas redes sociais? | Every `about.medias` URL |

**Entity resolution.** Company, technology, profile and post-title slots must resolve to the data:

- Companies: the exact name ignoring case, accents and punctuation ("E-tatica" → "E-tática"), the name without a trailing legal form ("Swisscom" → "Swisscom AG"), and reviewed aliases in `COMPANY_ALIASES` ("QAT", "Deevo", "Facil").
- Technologies: exact values, a documented variant rule (`X (qualifier)` is a variant of `X`, so "Java" also finds "Java (Android)"), and reviewed aliases in `TECHNOLOGY_ALIASES` ("JS" → "Javascript", "Node" → "Node.js", "Postgres" → "PostgreSQL", ...). Java never matches JavaScript and Angular never matches AngularJS.
- Profiles: `about.medias` titles and icons ("GitHub", "LinkedIn", "Facebook").
- Post titles: an exact title in either language, quotes optional.

An alias only applies when its target exists in the data. A name that matches two records is ambiguous and gets the fallback.

**Follow-ups.** Each answer can offer follow-up questions that name the company or technology explicitly ("Which technologies did you use at Swisscom AG?"). The engine is stateless: "And before that?" or "How long there?" fall back.

## What it will not answer

These fall back by design, even when related words appear in the CV:

- Salary, availability, work authorization, language fluency, qualifications, residence, preferences.
- Contact details: email and phone are not in the three JSON files (the Contact section is one click away).
- Tenure or skill calculations ("How many years of AWS experience?"), rankings, job fit.
- Why/how questions ("Why did you leave QAT Global?") and specific metrics inside descriptions ("What percentage did you reduce incidents by?").
- Compound or partly supported questions ("Tell me about Swisscom and forecast the weather", "…but invent achievements"): there is no partial answer.
- Visitor claims ("You worked at Google, right?"), instructions ("Ignore the rules…"), hypotheticals.
- Anything absent from the data. A technology missing from a role's list means "not answerable", never "no experience".
- A fact that exists only in the other language's data (for example a technology mentioned only in the PT description).

## Fallback policy

Every request the engine cannot answer gets this exact text, with a **Contact Guilherme** / **Entrar em contato com Guilherme** link to the resume's Contact section:

- EN: "I can’t answer this question using the information available in my CV. Please contact me directly so I can help."
- PT: "Não consigo responder a esta pergunta com as informações disponíveis no meu currículo. Entre em contato comigo diretamente para que eu possa ajudar."

Up to three supported questions are suggested under the latest fallback, never instead of it. The contact link only navigates; it does not prefill or submit the form.

Other states:

- **Data unavailable**: if any of the three files fails to load or fails validation, the assistant shows "The CV information could not be loaded. Please try again or contact me directly." with **Retry** and **Contact**, and the composer stays disabled. It never answers from a partial dataset.
- **Input validation**: empty input or more than 500 Unicode code points shows a message under the composer and adds nothing to the conversation. Overlong input is rejected, never truncated.

## Sources and citations

Each answer lists its sources ("Experience · Swisscom AG", "About me", a post title). Internally, each `SourceRef` names the file, the record (`about`, the experience ID or the post URL) and the exact JSON pointers of every field used. Links stay inside the current locale:

| Source | Link |
| --- | --- |
| About | `/#about` |
| Experience | `/?experienceId=<id>#experience` |
| Post | `/?post=<url>#posts` |
| Contact (fallback) | `/#contact` |

`ExperienceComponent` and `PostsComponent` read these parameters after their data loads, and again on every navigation (including back/forward and following the same citation twice). They then select the experience by ID (mapped to its carousel position) or open the posts page that holds the URL, scroll to the section and focus the record. Unknown identifiers leave the carousel as it is. The resume keeps a `#fragment` target in view while its data-driven sections render, so a citation or the contact link lands on the right place on phones too. Only generated record identifiers ever go into the URL, never question or answer text.

Post and profile citations also get an **Open link** to the article or profile, but only for parsed `http(s)` URLs, opened with `rel="noopener noreferrer"`. A source with any other scheme keeps its internal citation and gets no outgoing link.

## Session lifetime and privacy

- The conversation (at most 50 question/answer pairs; the oldest pair is dropped first, with a notice), the unsent draft and the panel state live in memory in the root `AssistantSessionService`. They survive navigation inside the app (resume ↔ `/assistant`, citations, back/forward).
- Refreshing, closing the tab or switching language starts a new conversation: the language links load the other locale's build. Nothing is written to `localStorage`, IndexedDB, a server or an account. The page says this next to **Clear conversation**.
- The three JSON files are loaded once per session, from the same origin. Answering makes no request at all.
- Questions, drafts and answers are never sent to Firebase, Analytics or any other service, never logged to the console and never put in URLs. The existing analytics still records page views (`screen_view` with the URL), as it does for the rest of the site.
- Visitor text and JSON content are always rendered as text. HTML in the JSON is converted to inert plain text without building a DOM, so no markup is attached, no script runs and nothing is fetched while extracting text.

## Updating the CV data

Edit the JSON files as before (posts through the [`add-post` skill](add-post-skill.md)); the assistant picks the changes up on the next load. Suggestions and follow-ups are derived from the data and are only shown when they answer. Keep in mind:

- Each record needs an `en` and a `pt` entry. Experiences need `id` (unique integer), `position`, `companyName` and `startAt` (`MM-DD-YYYY`), and `role`/`description` in both languages; posts need a unique `http`, a valid `date` and `title`/`description` in both languages. Invalid data makes the assistant report itself unavailable (the reason is logged with `console.warn`), so run `npm test` after editing.
- A new company name works as an entity automatically. Add a short alias to `COMPANY_ALIASES` only when visitors would use a shorter name that the legal-form rule does not cover.
- A new hobby title needs a PT translation in `ANSWER_TEMPLATES.pt.hobbyTitles`, otherwise the PT hobbies question falls back.
- A new file in `src/assets/data/` is not used until it gets an adapter, validation and tests (see below).

## Adding a new intent

Work in this order, and keep uncertain wording unsupported rather than widening a pattern until a test passes:

1. **Fields**: name the JSON fields that answer it, and check that they exist in both languages. Never put a CV fact in code.
2. **Parser rule**: add the intent to `IntentId` (`models/assistant.models.ts`) and full-question EN and PT forms to `question-patterns.ts`, capturing only declared slots (`{company}`, `{technology}`, `{topic}`, `{title}`, `{network}`).
3. **Evidence condition**: slots resolve in `resolve-question.ts`. In `compose-answer.ts`, return `null` whenever the needed field is absent for the locale, which becomes the fallback.
4. **Template**: add the fixed wording for both locales to `answer-templates.ts`. Its arguments must be values read from the snapshot.
5. **Provenance**: cite every record through `citeAbout`/`citeExperience`/`citePost`, including the pointer of each field the answer uses, and put each interpolated value in the line's `facts`.
6. **Fixtures**: add EN and PT positive cases and adversarial negative cases to `engine/assistant-engine.spec.ts` (the `POSITIVE`/`NEGATIVE` tables). `expectGrounded` checks that every fact and excerpt equals the JSON at its pointer and is cited.

Do not add an external answer service, fuzzy matching, a similarity threshold or a language model to improve coverage; that would be a separate project with its own cost and privacy review.

## Code map

```text
src/app/assistant/
  models/assistant.models.ts         snapshot, SourceRef, AnswerBlock and AnswerResult types
  knowledge/plain-text.ts            HTML -> inert plain-text paragraphs (no DOM)
  knowledge/knowledge-adapter.ts     validation, JSON pointers, frozen KnowledgeSnapshot
  knowledge/assistant-knowledge.service.ts   loads the 3 files via DataService once; idle/loading/ready/error + retry
  engine/normalize-question.ts       length validation, folding, keys, tokens
  engine/question-patterns.ts        reviewed EN/PT patterns (finite, anchored)
  engine/resolve-question.ts         slot resolution, reviewed aliases, ambiguity checks
  engine/compose-answer.ts           per-intent answers with provenance, stable ordering
  engine/answer-templates.ts         fixed EN/PT wording, month names, hobby label translations
  engine/assistant-engine.ts         answerQuestion(), suggestedQuestions(), follow-ups (pure)
  state/assistant-session.service.ts root in-memory conversation, draft, panel state, 50-pair cap
  ui/chat, conversation, composer, suggestions, source-links, panel, launcher
  pages/assistant-page/              the /assistant route
  testing/assistant-fixtures.ts      real-data fixtures and grounding assertions for specs
```

The engine (`engine/`, `knowledge/plain-text.ts`, `knowledge/knowledge-adapter.ts`) does not depend on Angular, HTTP, storage, the clock or randomness. The same question, locale and data always give the same answer and source order. UI strings use Angular i18n (`assistant@@assistant.*` IDs in `src/locales/messages.*.xlf`). Answer wording lives in `answer-templates.ts`, so the engine can be tested in both locales in one run.

## Testing

```bash
npm test -- --watch=false --browsers=ChromeHeadless   # adapter, plain text, engine corpus (EN/PT), session
npm run build-locale && npm run test:e2e:run           # e2e/assistant.spec.ts plus the existing suite
```

`e2e/assistant.spec.ts` covers, in both locales and on desktop and mobile: the welcome CTA and shortcut, page suggestions (each one answers), citations revealing an experience and a post on another carousel page, the fallback and contact handoff (no Firestore traffic), validation, Enter/Shift+Enter, text-only rendering, the panel (focus, Escape, scroll restoration, history and draft across close/expand/return), header navigation, reload, data failure with Retry, the 320 px layout, and that questions never appear in requests, console output, URLs or the analytics `dataLayer`.

## Limitations

- Only the forms in `question-patterns.ts` are understood; synonyms and word orders outside them fall back. Questions with typos fall back.
- Post search matches whole words only (no stemming): "flashcards" does not match "flash card".
- Answers about technologies reflect the `technologies` lists only. A tool mentioned only in a description (e.g. Kubernetes) is not found by "Where have you used …?", though it appears in that company's overview excerpt.
- One conversation per tab and language; no persistence across reloads or locale switches.
