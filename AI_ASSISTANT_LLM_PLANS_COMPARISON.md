# CV Assistant: interpreter (3A) vs. answering (3B), comparison

Status: analysis for a decision; nothing here is implemented. Written on 25 October 2026. All prices are the figures the two plans quote; they were not rechecked for this comparison.

Compared documents:

- [`AI_ASSISTANT_LLM_INTERPRETER_PLAN.md`](AI_ASSISTANT_LLM_INTERPRETER_PLAN.md), **option 3A**: Claude Haiku 5.5 on a Firebase Cloud Function picks the question type and CV names; the existing engine and templates write the answer.
- [`AI_ASSISTANT_LLM_ANSWERING_PLAN.md`](AI_ASSISTANT_LLM_ANSWERING_PLAN.md), **option 3B**: Amazon Nova Micro on AWS (API Gateway, Lambda, Bedrock, DynamoDB) writes the answer itself, with evidence IDs.

## 1. Side by side

| | **3A: interpreter** | **3B: answering** |
| --- | --- | --- |
| **Risk of wrong facts** | The model can't state a fact. It returns names from fixed lists, and the answer is built from the JSON. The worst case is answering the wrong question correctly, with its sources. | It can make things up. The plan itself says a valid citation doesn't prove the sentence next to it is true, so safety depends on the evaluation set. |
| **What visitors gain** | Only the 17 existing question types, but asked in any wording, with typos, in other languages, or several at once. | Real summaries and combined answers ("summarize the DevOps work for a recruiter"). This is the one thing 3A can't do. |
| **Answer style** | Same fixed templates as today: consistent but stiff. | Natural prose, labelled "AI-generated". |
| **Cost per question** | About $0.00008 with a cache hit, $0.00025 to budget. | About $0.00018 normally, $0.00035 at the maximum. Cheaper per token, but it sends the whole CV (4–8K tokens) on every call. |
| **Monthly cost** | Under $1. Firebase and reCAPTCHA free tiers cover the 9K/month cap. | Under about $3.30 for the model, plus small API Gateway, Lambda and DynamoDB charges. |
| **Hard spending cap** | Yes: the Anthropic workspace spend limit is enforced by the provider. | No provider-side cap on AWS, which is why the plan builds its own reservation system in DynamoDB. |
| **Bot protection** | Reuses the site's App Check setup with single-use tokens. | Per-IP limits and CORS only. Bots can burn the daily allowance and switch the feature off for real visitors. |
| **New infrastructure** | One callable function, one secret, one Firestore counter. Needs Blaze, the Firebase pay-as-you-go plan. | HTTP API, Lambda, DynamoDB, IAM, a SAM template, a CORS/CloudFront route and a version check between frontend and backend. |
| **Hardest code** | `answerInterpretation` (exact matching on top of the existing engine), plus a click-triggered request. | Spend reservations stored in microdollars, de-duplication of in-flight requests, evidence maps, and an async session state machine. |
| **Structured output** | The API enforces the JSON schema. | Schema enforcement isn't assumed, so more output gets thrown away. |
| **Privacy** | The visitor consents per question by clicking. Logs keep only counts. | Sent automatically after a standing notice, plus a local-only toggle. It also keeps hashed IPs and stored replies for de-duplication, which is more to disclose. |
| **Vendors** | Adds Anthropic. Google (Firebase) is already in use. | Stays within AWS, which already hosts the site. This is 3B's main operational advantage. |
| **Effort** | 3–5 days plus about $0.04 of evaluation. | No estimate given. With 8 deliverables and the quota work, realistically 2–3× more. |

## 2. Maintenance

- **3A:** the name lists rebuild from the JSON at deploy, so new companies, technologies and posts work without code changes. A new kind of question still needs a pattern, a template and test fixtures, the same as today. A model update rarely matters, because the model only classifies.
- **3B:** new content is answerable straight away, with no work per question type. The cost is ongoing: every model or prompt change means rerunning a strict factual evaluation. There is also a second backend to keep, the quota tables, and the version sync between frontend and backend.

## 3. Recommendation

**Go with 3A.**

- **Risk:** on a resume, one invented fact shown to a recruiter costs more than 3B's better wording earns. 3A rules that out by design; 3B only tests for it.
- **Release gate:** 3B requires zero unsupported claims, which is a tall order for Nova Micro. The plan's own fallback if it fails is to do 3A.
- **Cost:** about equal, and negligible for both.
- **Simplicity:** 3A is clearly simpler, mainly because the Anthropic spend limit and App Check remove most of 3B's quota and abuse work.

Two adjustments:

- **Keep from 3B:** stable post IDs derived from the post URL instead of 3A's `post-0…post-9` array positions, which shift whenever a post is added.
- **If summaries are wanted later:** add a few summary question types with templates (for example, a summary of technologies across roles) rather than switching to free prose.

If running everything on AWS matters more, 3A's design could also call Claude through Bedrock from Lambda. That loses App Check and the provider spend limit, so it isn't worth it unless avoiding a new vendor is the priority.

## 4. Covering more questions by expanding the CV data

### 4.1 What 3A can't answer today

3A can't write a summary. Take "Summarize his DevOps work": the model would most likely pick the existing technology question, and the template would answer roughly "DevOps appears in my CV at: Swisscom AG · role · dates". Swisscom AG is the only experience that lists DevOps in its `technologies`. Other roles mention DevOps only in their description text, so the answer would skip them and wouldn't say what the work was.

With the deterministic engine or 3A, the way to answer more questions without letting a model write answers is to add data. Data alone isn't enough, though. Each new kind of answer needs data plus a small amount of engine work.

### 4.2 What the data holds today

- `about.json`: one description, the hobbies and the social links.
- `experiences.json`: 6 roles, each with company, role, dates, location, a description of 740–1,120 characters and 15–23 technologies.
- `posts.json`: 10 posts with title, description and date.

Everything in `docs/cv-assistant.md` under "What it will not answer" is a gap in the data, not in the engine: education, certifications, spoken languages, availability, work authorization, achievements and tenure.

### 4.3 What adding data would unlock

| New data | Questions it answers | Where it fits |
| --- | --- | --- |
| Education (school, degree, years) | "What did you study?", "Where did you graduate?" | New `education` list, e.g. in `about.json` |
| Certifications (name, issuer, date, link) | "Which AWS certifications do you have?" | New `certifications` list |
| Spoken languages and level | "Do you speak German?" | New `languages` list in `about.json` |
| Topic summaries written by Guilherme, each linked to the roles it covers | **"Summarize his DevOps work"**, "What's his leadership experience?" | New `topics` list: `{ id, aliases, experienceIds, internationalizations: [{ summary }] }` |
| Key achievements per role (short bullets) | "What did he achieve at Swisscom?" | New `highlights` field on each experience |
| Availability or work authorization, only if kept current | "Is he open to work?", "Does he need a visa?" | A single dated field, e.g. `availability: { status, updatedAt }` |

The **topic summaries** are how to get summaries without a model. Each summary is written once in EN and PT and humanized like the post texts. The assistant shows it word for word, with links to the roles it covers. Visitors get a real summary, and nothing can be invented. The cost is writing and maintaining each summary, and only the topics that have been written are covered.

### 4.4 The work per new kind of answer

1. Add the field to the JSON in both `en` and `pt`.
2. Validate it in `knowledge/knowledge-adapter.ts`.
3. Add EN/PT patterns to `question-patterns.ts` and a template to `answer-templates.ts`.
4. Add fixtures to `assistant-engine.spec.ts`.

That's roughly a few hours per kind of answer. With 3A, the model's fixed lists pick up the new names automatically, and only the list of question types gets the new entries. With 3B, new data is answerable as soon as it's deployed, but with 3B's risk of invented facts.

### 4.5 Decisions before adding data

- **Show it on the page, or only in the assistant?** Answers link to a section of the page as their source. If education or certifications aren't shown anywhere, that link has nowhere to go. The suggestion is a small "Education & certifications" block in About, or else a citation that points to the data itself.
- **What to leave out:** salary and availability go out of date. Unless they'll be kept current, it's safer to keep sending those questions to Contact.
