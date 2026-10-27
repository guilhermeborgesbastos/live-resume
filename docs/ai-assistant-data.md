# Updating the AI Assistant's data

The AI Assistant answers only from three files in `src/assets/data/`: `about.json`, `experiences.json` and `posts.json`. Edit them, and the assistant (and the resume page) picks up the change on the next load. There is nothing else to retrain or configure.

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

## Check your change

```bash
npm test -- --watch=false --browsers=ChromeHeadless   # validates the data and the answers
npm run test:e2e                                      # browser checks in EN and PT
```

If a file is invalid (a missing language, a malformed date, an unknown `experienceIds` value), the assistant shows "The CV information could not be loaded" instead of answering, and the unit tests name the field that failed. Then ask a question about what you changed at `/en/assistant` and `/pt/assistant`.
