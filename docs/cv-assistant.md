# CV Assistant

A rule-based assistant that answers a documented set of questions about the CV, in English and Portuguese. It runs entirely in the browser: answers are built from `src/assets/data/about.json`, `experiences.json` and `posts.json` with fixed templates or verbatim excerpts. There is no language model, inference endpoint, embedding, search service or new runtime dependency, so there is no per-question model or API cost and no AWS resource; the assistant only adds static bytes to the existing hosting.

For the internal design (architecture, pipeline, a worked example and open review questions), see [cv-assistant-design.md](cv-assistant-design.md).

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
| `/assistant` page | `/en/assistant`, `/pt/assistant` (lazy route, header item **AI Assistant** / **Assistente de IA**; the UI calls the feature "AI Assistant") | Full-page conversation: scope and disclosure, starter suggestions, transcript, composer, **Clear conversation**, **Back to the resume**. Not a dialog. |
| Floating panel | Fixed **Ask my AI Assistant** button with a robot icon on the resume while About, Experience or Posts is the active section | A modal `<dialog>` (desktop: about 420 px wide; phones: a bottom sheet above the keyboard with safe-area padding). Escape or the backdrop closes it, focus returns to the button and the page scroll position is restored. **Expand** carries the conversation and the unsent draft to `/assistant`. Not rendered on `/assistant` or the 404 page. |

Both use the same engine, data snapshot and session (`AssistantSessionService`).

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
| Education | What did you study? | O que você estudou? | `about.education`: degree, field of study, school, years (no completion status) |
| Certifications | Which certifications do you have? | Quais certificações você tem? | Every `about.certifications` entry, newest first, typed as certification / course certificate / badge, with a note that issue dates do not confirm current validity |
| Issuer certifications | Are you AWS certified? | Você é certificado pela AWS? | The certifications from that issuer, with the same validity note |
| Languages | Which languages do you speak? | Quais idiomas você fala? | `about.languages` names with the self-reported level |
| Language proficiency | Do you speak English? | Você fala inglês? | That language's self-reported level; an unlisted language falls back |
| Topic summary | Summarize your DevOps work. | Resuma sua experiência em DevOps. | The topic's `summary` excerpt from `about.topics`, plus the roles it lists in `experienceIds` |
| Company highlights | What did you achieve at Swisscom? | O que você conquistou na Swisscom? | That role's `highlights` |

**Entity resolution.** Company, technology, profile and post-title slots must resolve to the data:

- Companies: the exact name ignoring case, accents and punctuation ("E-tatica" → "E-tática"), the name without a trailing legal form ("Swisscom" → "Swisscom AG"), and reviewed aliases in `COMPANY_ALIASES` ("QAT", "Deevo", "Facil").
- Technologies: exact values, a documented variant rule (`X (qualifier)` is a variant of `X`, so "Java" also finds "Java (Android)"), and reviewed aliases in `TECHNOLOGY_ALIASES` ("JS" → "Javascript", "Node" → "Node.js", "Postgres" → "PostgreSQL", ...). Java never matches JavaScript and Angular never matches AngularJS.
- Profiles: `about.medias` titles and icons ("GitHub", "LinkedIn", "Facebook").
- Post titles: an exact title in either language, quotes optional.
- Certificate issuers: the issuer as listed, and for "Name (ABBR)" also the name or the abbreviation alone ("AWS" → "Amazon Web Services (AWS)").
- Languages: the language name in either site language ("English", "inglês").
- Topics: the topic `id`, its localized names and its `aliases` ("CI/CD" → DevOps), with hyphens read as spaces. Topic forms also accept "his" ("Summarize his DevOps work").

An alias only applies when its target exists in the data. A name that matches two records is ambiguous and gets the fallback.

**Follow-up chips.** Each answer can offer follow-up questions that name the company or technology explicitly ("Which technologies did you use at Swisscom AG?").

**Follow-ups about the same role.** When the latest answer was about exactly one experience, these reviewed follow-ups refer to it:

| EN | PT | Answers |
| --- | --- | --- |
| And before that? / What about after that? | E antes disso? / E depois disso? | Overview of the role that started right before / after it |
| Which technologies did you use there? | Quais tecnologias você usou lá? | That role's technologies |
| What was your role there? | Qual era o seu cargo lá? | That role's title |
| When was that? / When did you work there? | Quando foi isso? / Quando você trabalhou lá? | Its dates |
| Where was that? | Onde foi isso? | Its work location |
| Tell me more | Fale mais sobre isso | Its overview |
| What did you achieve there? | O que você conquistou lá? | Its highlights |

The answer always names the company, so the visitor can see which role "that" meant. A topic summary linked to exactly one role also sets that role as the referent. There is no referent after an answer about several records (employers, a technology across roles), a fallback, a clarification, or a cleared conversation; then these follow-ups fall back. "How long were you there?" stays unsupported (no tenure calculation).

**Near misses.** A name within a small spelling distance of a CV name ("Swiscom", "Javscript", "gitub") is never answered directly. The assistant replies "I couldn’t find that name in my CV exactly. Did you mean one of these questions?" with up to three corrected questions as buttons; nothing is answered until the visitor picks one. The same happens when a name fits several records ("That could refer to more than one thing in my CV…"). Tolerance depends on the name's length: none under 4 characters (so `js`, `ts`, `c#`, `jav` never drift), one edit for 4–7 characters, two from 8. The closest name wins, and exact names always win over aliases and near matches, so "Java" never suggests JavaScript.

## What it will not answer

These fall back by design, even when related words appear in the CV:

- Salary, availability, work authorization, residence, preferences.
- A language or certificate the CV does not list ("Do you speak Dutch?", "Which Google certifications do you have?"), whether a certificate is still valid, and whether the degree was completed ("Did you graduate?").
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

Up to three supported questions are suggested under the latest fallback, never instead of it. A near-miss or ambiguous name gets the "Did you mean…" options described in [Supported questions](#supported-questions) instead, still with the Contact link. The contact link only navigates; it does not prefill or submit the form.

Other states:

- **Data unavailable**: if any of the three files fails to load or fails validation, the assistant shows "The CV information could not be loaded. Please try again or contact me directly." with **Retry** and **Contact**, and the composer stays disabled. It never answers from a partial dataset.
- **Input validation**: empty input or more than 500 Unicode code points shows a message under the composer and adds nothing to the conversation. Overlong input is rejected, never truncated.

## Sources and citations

Each answer lists its sources ("Experience · Swisscom AG", "About me", a post title). Internally, each `SourceRef` names the file, the record (`about`, the experience ID or the post URL) and the exact JSON pointers of every field used. Links stay inside the current locale:

| Source | Link |
| --- | --- |
| About (including education, certifications, languages and topic summaries) | `/#about` |
| Experience | `/?experienceId=<id>#experience` |
| Post | `/?post=<url>#posts` |
| Contact (fallback) | `/#contact` |

`ExperienceComponent` and `PostsComponent` read these parameters after their data loads, and again on every navigation (including back/forward and following the same citation twice). They then select the experience by ID (mapped to its carousel position) or open the posts page that holds the URL, scroll to the section and focus the record. Unknown identifiers leave the carousel as it is. The resume keeps a `#fragment` target in view while its data-driven sections render, so a citation or the contact link lands on the right place on phones too. Only generated record identifiers ever go into the URL, never question or answer text.

Each certification is its own source, labelled with its name, so its credential page can be opened. Post, profile and certification citations also get an **Open link** to the article, profile or credential, but only for parsed `http(s)` URLs, opened with `rel="noopener noreferrer"`. A source with any other scheme keeps its internal citation and gets no outgoing link.

## Session lifetime and privacy

- The conversation (at most 50 question/answer pairs; the oldest pair is dropped first, with a notice), the unsent draft and the panel state live in memory in the root `AssistantSessionService`. They survive navigation inside the app (resume ↔ `/assistant`, citations, back/forward).
- Refreshing, closing the tab or switching language starts a new conversation: the language links load the other locale's build. Nothing is written to `localStorage`, IndexedDB, a server or an account. The page says this next to **Clear conversation**.
- The three JSON files are loaded once per session, from the same origin. Answering makes no request at all.
- Questions, drafts and answers are never sent to Firebase, Analytics or any other service, never logged to the console and never put in URLs. The existing analytics still records page views (`screen_view` with the URL), as it does for the rest of the site.
- Visitor text and JSON content are always rendered as text. HTML in the JSON is converted to inert plain text without building a DOM, so no markup is attached, no script runs and nothing is fetched while extracting text.

## Updating the CV data

Edit the JSON files as before (posts through the [`add-post` skill](add-post-skill.md)); the assistant picks the changes up on the next load. Suggestions and follow-ups are derived from the data and are only shown when they answer. Keep in mind:

- Each record needs an `en` and a `pt` entry. Experiences need `id` (unique integer), `position`, `companyName` and `startAt` (`MM-DD-YYYY`), and `role`/`description` in both languages; posts need a unique `http`, a valid `date` and `title`/`description` in both languages. Invalid data makes the assistant report itself unavailable (the reason is logged with `console.warn`), so run `npm test` after editing.
- `about.json` also holds optional `education` (`school`, `startAt`/`endAt` as `YYYY`, `degree` and `fieldOfStudy` per language), `certifications` (`name`, `issuer`, `type` of `certification`/`course`/`badge`, `issuedAt` and optional `expiresAt` as `MM-YYYY` or `YYYY`, optional `url`), `languages` (`code`, then `name` and `proficiency` per language) and `topics` (`id`, `aliases`, `experienceIds`, then `name` and `summary` per language). Each experience language entry may list `highlights`. Keep dates at the precision the source gives, record proficiency exactly as stated, and keep course certificates typed as `course`. Topic summaries and highlights are shown word for word, so write them in the first person from facts already in the CV.
- New issuers, languages and topics work as entities automatically; a topic only answers while every ID in its `experienceIds` exists.
- A new company name works as an entity automatically. Add a short alias to `COMPANY_ALIASES` only when visitors would use a shorter name that the legal-form rule does not cover.
- A new hobby title needs a PT translation in `ANSWER_TEMPLATES.pt.hobbyTitles`, otherwise the PT hobbies question falls back.
- A new file in `src/assets/data/` is not used until it gets an adapter, validation and tests (see below).

## Adding a new intent

Work in this order, and keep uncertain wording unsupported rather than widening a pattern until a test passes:

1. **Fields**: name the JSON fields that answer it, and check that they exist in both languages. Never put a CV fact in code.
2. **Parser rule**: add the intent to `IntentId` (`models/assistant.models.ts`) and full-question EN and PT forms to `question-patterns.ts`, capturing only declared slots (`{company}`, `{technology}`, `{topic}`, `{title}`, `{network}`, `{issuer}`, `{language}`, `{area}`).
3. **Evidence condition**: slots resolve in `resolve-question.ts`. In `compose-answer.ts`, return `null` whenever the needed field is absent for the locale, which becomes the fallback.
4. **Template**: add the fixed wording for both locales to `answer-templates.ts`. Its arguments must be values read from the snapshot.
5. **Provenance**: cite every record through `citeAbout`/`citeCertification`/`citeExperience`/`citePost`, including the pointer of each field the answer uses, and put each interpolated value in the line's `facts`.
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

`e2e/assistant.spec.ts` covers, in both locales and on desktop and mobile: page suggestions (each one answers), citations revealing an experience and a post on another carousel page, the fallback and contact handoff (no Firestore traffic), validation, Enter/Shift+Enter, text-only rendering, the panel (focus, Escape, scroll restoration, history and draft across close/expand/return), header navigation, reload, data failure with Retry, the 320 px layout, and that questions never appear in requests, console output, URLs or the analytics `dataLayer`.

## Limitations

- Only the forms in `question-patterns.ts` are understood; synonyms and word orders outside them fall back. Spelling tolerance applies to names (companies, technologies, profiles, post titles), not to the rest of the question: "Wher have you usd Java?" still falls back.
- Follow-up context covers one experience at a time and only the forms listed above.
- Post search matches whole words only (no stemming): "flashcards" does not match "flash card".
- Answers about technologies reflect the `technologies` lists only. A tool mentioned only in a description (e.g. Kubernetes) is not found by "Where have you used …?", though it appears in that company's overview excerpt.
- One conversation per tab and language; no persistence across reloads or locale switches.
