# Updating the AI Assistant's data

The AI Assistant answers from four files in `src/assets/data/`:

| File | Read by | Holds |
| --- | --- | --- |
| `about.json`, `experiences.json`, `posts.json` | the local assistant in the browser **and** the AI answers | everything the resume page shows |
| `assistant-context.txt` | the AI answers only | notes for facts the page doesn't show ([below](#notes-for-ai-answers-assistant-contexttxt)) |

Edit the JSON files, and the assistant (and the resume page) picks up the change on the next load. The AI answers bundle their own copy of all four files, so a change also needs a function deploy ([Publish your change](#publish-your-change)). There is nothing to retrain.

## Rules for every change

- **Both languages.** Every text lives in an `internationalizations` list with one `"language": "en"` entry and one `"language": "pt"` entry. A fact missing in one language is not answered in that language.
- **Write it as you want it read.** Answers repeat these texts word for word, in the first person ("I built…").
- **Only true, published facts.** The assistant never adds or guesses anything, so whatever is in the file is what visitors get.
- **Keep the date formats.** Jobs and posts use `MM-DD-YYYY`; certificates use `MM-YYYY`; education uses `YYYY`.

## Where each fact goes

| To change… | Edit | Fields |
| --- | --- | --- |
| Biography, hobbies, social links | `about.json` | `internationalizations[].description`, `hobbies`, `medias` |
| Education | `about.json` → `education` | `school`, `startAt`, `endAt`, and per language `degree`, `fieldOfStudy` |
| Certificates and courses | `about.json` → `certifications` | `name`, `issuer`, `type` (`certification`, `course` or `badge`), `issuedAt`, optional `expiresAt` and `url` |
| Spoken languages | `about.json` → `languages` | `code`, and per language `name`, `proficiency` |
| Topic summaries ("Summarize your DevOps work") | `about.json` → `topics` | `id`, `aliases` (words visitors may use), `experienceIds`, and per language `name`, `summary` |
| Jobs | `experiences.json` | `id` (unique), `companyName`, `startAt`, `endAt` (leave it out for the current job), `technologies`, and per language `role`, `description`, `city`, `country`, `highlights` |
| Posts | `posts.json` | Use the `/add-post` skill ([guide](add-post-skill.md)) rather than editing by hand |
| Anything the page doesn't show (years with a technology, how you work, relocation) | `assistant-context.txt` | See the next section |

For example, a new certificate in `about.json`:

```json
{
  "name": "AWS Certified Developer – Associate",
  "issuer": "Amazon Web Services (AWS)",
  "type": "certification",
  "issuedAt": "03-2027",
  "url": "https://www.credly.com/badges/…"
}
```

Good to know:

- "Did you use Kubernetes?" only looks at a job's `technologies` list, not its description. List every tool you want to be found.
- A topic only answers while every ID in its `experienceIds` exists in `experiences.json`.
- A new hobby also needs its Portuguese name in `hobbyTitles` in `src/app/assistant/engine/answer-templates.ts`.

## Notes for AI answers (`assistant-context.txt`)

Some reasonable questions need facts the resume page doesn't show: "How many years of Java experience do you have?", "Have you worked in multicultural teams?", "Would you relocate?". Rather than adding a JSON field for each, write a short note. Only the AI answers read the notes, and they cite a note like any other source ("My notes · Java experience (Oct 2026)").

Use a JSON field when the fact belongs on the page (a new job, a certificate). Use a note when it doesn't.

**The file is public.** It ships with the site, so anyone can open it. Write only what you'd tell a recruiter. Leave out phone numbers, addresses, e-mail addresses, links, salary figures you don't want published, and other people's names.

### Format

Plain text. Lines starting with `#` are comments, and a blank line ends a note. Every note looks like this:

```text
[java-experience]
updated: 2026-10
related: exp.3 exp.4 exp.5 exp.6
title.en: Java experience
title.pt: Experiência com Java
en: I have worked with Java since 2014, first for Android apps and later for backend services.
pt: Trabalho com Java desde 2014, primeiro em apps Android e depois em serviços de backend.
```

(The text above only shows the format; write your own.)

| Field | Rule |
| --- | --- |
| `[id]` | Lowercase letters, digits and dashes; unique. Don't reuse an ID for a different fact |
| `updated` | `YYYY-MM`: the month you last checked the note. Over 12 months old gives a warning; over 24 months fails the check, so old notes get reviewed |
| `related` | Optional. Experience IDs from `experiences.json` (`exp.6`) the note is about; they're added as citation links |
| `title.en`, `title.pt` | Up to 60 characters; the citation label |
| `en`, `pt` | Both required, on one line each, up to 600 characters; plain text only |
| Whole file | At most 30 notes and about 5,000 characters per language (roughly 1,500 tokens, which is what each AI answer pays for) |

### Writing good notes

- **State dates, not durations.** Write "since 2014", not "12 years": the AI quotes numbers exactly as written and never does the arithmetic, so a duration would go stale.
- **Date anything that changes.** "Open to new roles as of October 2026", not "open to new roles".
- **Keep EN and PT saying the same thing.** Each language only sees its own text.
- **Don't contradict the JSON.** For roles, dates and technologies, the AI follows the JSON when a note disagrees.
- **Run the text through the humanizer**, like the post texts, before you commit it.

## Check your change

```bash
npm run validate:context                              # the notes file: format, both languages, limits, age
npm test -- --watch=false --browsers=ChromeHeadless   # validates the data and the answers
npm run test:e2e                                      # browser checks in EN and PT
```

If a JSON file is invalid (a missing language, a malformed date, an unknown `experienceIds` value), the assistant shows "The CV information could not be loaded" instead of answering, and the unit tests name the field that failed. Then ask a question about what you changed at `/en/assistant` and `/pt/assistant`.

## Publish your change

1. `npm --prefix functions run deploy` bundles the four files into the `askAssistant` function and deploys it. Do this first: the function then knows the new data before any page asks about it.
2. `./deploy.sh` publishes the site (see `DEPLOYMENT.md`).

Between the two steps, a visitor with the old page open who asks an AI question sees "This page has an older copy of my CV. Reload it…". A notes-only change doesn't cause that, because the notes aren't part of the page's data version.
