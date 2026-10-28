# CV Assistant AI answers: what's left for you to do

Written on 28 October 2026 for branch `feature/ai-assistant-firebase`. It lists everything between the code on that branch and AI answers being live on the site, in order. The design is in [`AI_ASSISTANT_LLM_FIREBASE_PLAN.md`](AI_ASSISTANT_LLM_FIREBASE_PLAN.md); the operating manual is the "AI answers (Firebase)" section of [`DEPLOYMENT.md`](DEPLOYMENT.md#ai-answers-firebase).

## Where things stand

| Plan deliverable | Status |
| --- | --- |
| H1 Google Cloud setup and project files | Project files done (`firebase.json`, `.firebaserc`); **cloud setup is yours** (§4) |
| H2 Evidence map and CV snapshot | Done |
| H2b Notes file, parser, validator, CI | Done; **the notes themselves are yours** (§3) |
| H3 + H4 Cloud Function and grounding checks | Done, tested with a stubbed model; not deployed |
| H5 Site changes | Done, behind `assistantHosted.enabled: false` |
| H6 Evaluation against the real model | **Not started**: needs your approval for the spend (§6) |
| H7a Visitor copy review (EN/PT) | Written; **your review and the humanizer pass are left** (§7) |
| H7b Documentation | Done (tracked docs on the branch; the two local-only docs copied to your checkout) |
| H8 Rollout | **Yours** (§8) |
| H9 First two weeks | **Yours** (§9) |

Nothing has been deployed and no paid model call has been made. With the flag off, the site behaves exactly like `master`.

Two switches control the feature; both must be on for any visitor question to leave the browser:

1. `assistantHosted.enabled` in `src/environments/environment.ts` and `environment.prod.ts` (site build).
2. The Firestore document `assistantConfig/runtime` with `enabled: true` (function). Missing means off.

---

## 1. Review and merge the branch

- [ ] Open a pull request from `feature/ai-assistant-firebase` to `master`. CI runs on pull requests (it doesn't run on pushes to feature branches), including the new steps: `validate:context` and the functions package (install, typecheck, tests, bundle).
- [ ] Review the five commits:
  - `0fd6ba2` the plan
  - `f91b0d7` notes file and evidence map
  - `e7ba076` the Cloud Function
  - `4e98559` the site changes
  - `ecff86b` documentation
- [ ] Decide whether `AI_ASSISTANT_LLM_FIREBASE_PLAN.md` (and this file) should stay in git. Your other plan files are listed in `.gitignore` as local-only; these two are currently committed.
- [ ] Merge. It's safe to merge before any cloud setup, because the feature stays off.

Local checks if you want to repeat them (`CHROME_BIN` is only needed if Karma can't find Chrome):

```bash
npm ci && npm --prefix functions ci
npm run lint && npm run validate:context
npm test -- --watch=false --browsers=ChromeHeadless
npm --prefix functions run typecheck && npm --prefix functions test && npm --prefix functions run build
npm run test:e2e
```

## 2. Confirm the decisions the code assumes

The plan (§13) left these open. The code uses the recommended option for each; change it if you disagree before going live.

| # | Decision | What the code does now | Where to change it |
| --- | --- | --- | --- |
| 1 | Trigger | Sends automatically after an eligible fallback, with a notice and an "Answer only locally" switch | `assistant-session.service.ts` |
| 2 | Which fallbacks are sent | `unrecognized`, `unknown-entity`, `no-results` | `HOSTED_FALLBACK_REASONS` in `api/hosted-answer.ts` |
| 3 | History sent | Last two answered exchanges, answers cut to 600 characters | `MAX_HISTORY_PAIRS` in `models/hosted-answer.models.ts` |
| 4 | Partly covered questions | Answer the covered part, plus the fixed "My CV doesn't cover the rest…" line | prompt rule 6 in `functions/src/core/prompt.ts` |
| 5 | Limits | 150 calls/day, 3/minute and 20/day per visitor, $5/month estimated model spend | deploy parameters (§4.8) |
| 6 | Privacy wording | Notice and "How this works" in EN/PT; no retention sentence yet | §7 below |
| 8 | Model access | Claude Haiku 5.5 on Vertex AI, `eu` multi-region | `VERTEX_REGION`, `ASSISTANT_MODEL` parameters |
| 9 | Notes file published with the site | Yes (it lives under `src/assets/`) | add an `ignore` for it in `angular.json` assets to keep it function-only |
| 10 | Notes budget | Up to ~1,500 tokens per language; monthly cap $5 | raise `MONTHLY_BUDGET_MICROS` to `6000000` if your notes get long |

## 3. Write your notes

`src/assets/data/assistant-context.txt` currently holds only instructions and a commented-out example; the AI answers have no notes yet. Without notes, questions like "How many years of Java experience does Guilherme have?" still get the fallback.

- [ ] Decide which questions you want answerable that the resume page doesn't cover. Good first notes:
  - Java experience: the start year and what you used it for.
  - Working in international or multicultural teams.
  - Optionally relocation or remote work, and work authorization. Only add these if you're happy for them to be public, and date them, e.g. "as of October 2026".
- [ ] Write each note in the format described in [`docs/ai-assistant-data.md`](docs/ai-assistant-data.md#notes-for-ai-answers-assistant-contexttxt). Rules to keep in mind:
  - one line per language, at most 600 characters each, with `title.en` / `title.pt`;
  - `updated: YYYY-MM`;
  - optional `related: exp.<id>`;
  - write dates ("since 2014"), not durations ("12 years");
  - no links, e-mail addresses, phone numbers or HTML.
- [ ] Run the EN and PT text through the humanizer skill, as you do for posts.
- [ ] `npm run validate:context`.
- [ ] Commit in a small PR. It changes nothing visible while the feature is off.

Remember the file is **public**: it ships with the site at `/en/assets/data/assistant-context.txt` unless you change decision 9.

## 4. Google Cloud setup (H1)

All commands use the project `live-resume-a575a`. Do them in this order. Nothing here costs money until §8.

### 4.1 Tools

```bash
npm install -g firebase-tools
firebase login
gcloud auth login
gcloud config set project live-resume-a575a
```

### 4.2 Blaze plan

- [ ] Firebase console → Usage and billing → upgrade to **Blaze**. Cloud Functions, Vertex AI and Secret Manager need it.

### 4.3 Firestore: rules and TTL

- [ ] Firestore → Rules: confirm no rule allows `assistantUsage`, `assistantRate` or `assistantConfig` (anything no rule allows is denied). If you have a catch-all `match /{document=**}` allow, add explicit `allow read, write: if false;` blocks for those three collections.
- [ ] **Don't** run `firebase deploy --only firestore:rules` until you've copied the console rules into a `firestore.rules` file in the repo. Otherwise the deploy replaces your contact-form rules.
- [ ] TTL for the rate-limit keys:

  ```bash
  gcloud firestore fields ttls update expireAt --collection-group=assistantRate --enable-ttl
  ```

- [ ] Note the Firestore location (Firestore → Settings). The function runs in `europe-west4`; if Firestore is far from there, tell me and we'll move the function's region.

### 4.4 Vertex AI and the model

- [ ] `gcloud services enable aiplatform.googleapis.com`
- [ ] Console → Vertex AI → Model Garden → **Claude Haiku 5.5** → accept the terms and enable it.
- [ ] Check it's offered on the **`eu`** multi-region. If it isn't, use `VERTEX_REGION=global` (same price as the Claude API, but processing may leave the EU) and remove "in the EU" from the notice copy (§7).
- [ ] Check the quota for Claude Haiku 5.5 in that region (IAM & Admin → Quotas). Request a small increase if it's zero.
- [ ] Write down the actual `eu` prices. The function's cost estimate assumes $0.11 / $0.55 per million input / output tokens (`PRICE_MICROS_PER_TOKEN` in `functions/src/core/limits.ts`). If the prices differ, tell me and I'll update the constants.

### 4.5 Service account for the function

```bash
gcloud iam service-accounts create assistant-fn --display-name="CV assistant function"
for role in roles/aiplatform.user roles/datastore.user; do
  gcloud projects add-iam-policy-binding live-resume-a575a \
    --member=serviceAccount:assistant-fn@live-resume-a575a.iam.gserviceaccount.com --role=$role
done
```

You'll set `ASSISTANT_SERVICE_ACCOUNT=assistant-fn@live-resume-a575a.iam.gserviceaccount.com` at deploy (§4.8). If you skip this, the function runs as the default compute service account, which then needs `roles/aiplatform.user`.

### 4.6 Rate-limit secret

```bash
openssl rand -hex 32          # copy the output
firebase functions:secrets:set RATE_LIMIT_SALT
```

### 4.7 Budget backstop

```bash
gcloud pubsub topics create assistant-budget
```

- [ ] Billing → Budgets & alerts → create a budget for the project, e.g. **$10/month**, with thresholds 50%, 90% and 100%. Under "Manage notifications", connect the Pub/Sub topic `assistant-budget`.

`onBudgetAlert` turns the feature off when actual spend reaches the budget. Billing data arrives hours late, so this is only a backstop. The per-call limits are what keep spending bounded.

### 4.8 Deploy the function (switch still off)

```bash
npm --prefix functions run deploy
```

On the first deploy the CLI asks for the parameters and saves your answers to `functions/.env.live-resume-a575a`. Suggested answers:

| Parameter | Value |
| --- | --- |
| `VERTEX_REGION` | `eu` (or `global`, see §4.4) |
| `ASSISTANT_MODEL` | `claude-haiku-5-5` |
| `DAILY_CALL_LIMIT` | `150` |
| `PER_CLIENT_PER_MINUTE` | `3` |
| `PER_CLIENT_PER_DAY` | `20` |
| `MONTHLY_BUDGET_MICROS` | `5000000` |
| `BUDGET_TOPIC` | `assistant-budget` |
| `ASSISTANT_SERVICE_ACCOUNT` | `assistant-fn@live-resume-a575a.iam.gserviceaccount.com` |

Decide whether to commit `functions/.env.live-resume-a575a`. It holds no secrets (the salt is in Secret Manager), and committing it keeps deploys reproducible.

- [ ] Firebase console → Functions: `askAssistant` (europe-west4) and `onBudgetAlert` are listed.
- [ ] App Check → APIs → Cloud Functions: the API shows up. Enforcement is already in the code; there's nothing to click.
- [ ] Don't create `assistantConfig/runtime` yet. Until it exists, every call answers "unavailable" and nothing is spent.

## 5. Try it yourself before anyone else can

This tests the deployed function from your own machine while the live site still has the feature off.

1. Make sure your reCAPTCHA key allows `localhost` (Fraud Defense → the key's domains). If you use a separate key for localhost, put it in `environment.ts`, not `environment.prod.ts`.
2. In Firestore, create `assistantConfig/runtime` with field `enabled` = `true` (boolean).
3. Locally, without committing, set `assistantHosted.enabled: true` in `src/environments/environment.ts`, then run `npm run start:en`.
4. In a **normal** (not incognito, not headless) browser window, open http://localhost:4200/en/assistant and ask a question the local assistant can't answer, e.g. "How did your career move from web development to DevOps?".
5. Check:
   - "Thinking about your question…" appears, then a short answer with the AI label and sources.
   - Cloud Logging → `askAssistant` has an `ask` event, and it contains no question text.
   - Firestore `assistantUsage/<today>` counts the call.
6. Set `enabled` back to `false`, and revert `environment.ts`.

If you see "AI answers aren't available right now", the `ask` log event says why: `failure` (Vertex/IAM), `limit`, or `check` (an answer rejected by the grounding checks).

## 6. Evaluation (H6): needs your approval

The plan's release gate is an evaluation of about 200 annotated EN/PT questions against the real model before visitors get AI answers. **It isn't built yet.** When you approve the spend, I can build it as a script under `functions/eval/` that calls the deployed function (or Vertex directly) and reports:

- whether any answer states a fact that isn't in the cited sources (the target is zero);
- whether salary, availability, visa and false-premise questions all fall back;
- the share of useful answers;
- how often replies fail the checks;
- p50/p95 latency, cost per call and cache hit rate.

It would also compare thinking off with adaptive thinking at low effort, and the 5-minute with the 1-hour cache.

- Estimated cost: about **$0.50** at Claude Haiku 5.5 prices, with adversarial questions run three times.
- What I need from you: approval of that budget, the expected answer for each question category (I'll draft them for your review), and your notes from §3, so the notes-based questions can be tested.
- Gate: no answer with an unsupported fact, at least 90% useful answers, at least 99% valid replies, p95 latency of 5 seconds or less. If it fails, the feature stays off, and the plan lists what to try next.

## 7. Review the visitor copy (H7a)

The new strings are in `src/locales/messages.en.xlf` and `messages.pt.xlf` (IDs `assistant.ai.*`). I wrote the Portuguese myself, and the humanizer pass hasn't been run.

- [ ] Read them on the page in both languages: the notice under the composer, "How this works", the AI label, and the pending, unavailable, partial and reload messages.
- [ ] Run them through the humanizer skill.
- [ ] Check Vertex AI's data-governance terms for your account (Agent Platform and zero data retention). If inputs can be retained or logged, add a sentence to "How this works" saying so.
- [ ] If you end up on `VERTEX_REGION=global`, remove "in the EU" from `assistant.ai.notice` and `assistant.ai.howItWorks.model` in both files.
- [ ] Consider whether you want a privacy-policy page. The plan names you as the controller; the notice currently doesn't.

## 8. Turn it on (H8)

Only after §6 passes.

1. Firestore: `assistantConfig/runtime.enabled = true`.
2. Set `assistantHosted.enabled: true` in **both** `environment.ts` and `environment.prod.ts`. Run `npm run test:e2e` and commit.
3. If the CV data or notes changed since the last function deploy, run `npm --prefix functions run deploy` first.
4. `./deploy.sh` (the S3 site deploy, unchanged).
5. On the live site, in a normal browser window, in both `/en/assistant` and `/pt/assistant`: ask one question the local assistant answers (no request should go out) and one it can't (you should get an AI answer).

## 9. The first two weeks (H9)

- [ ] Every few days, look at Firestore `assistantUsage/<day>`:
  - `outcomes.answered`, `unsupported`, `invalid`, `error`, `limited`;
  - token counts and `costMicros`;
  - `assistantUsage/<month>.costMicros`.
- [ ] If `invalid` is high, filter the `askAssistant` logs by `check` to see which grounding check is rejecting answers, and tell me before changing anything.
- [ ] If `limited` is high, check whether it's bots (App Check → APIs → Cloud Functions shows unverified traffic) or real visitors (then consider raising `DAILY_CALL_LIMIT`).
- [ ] Watch the App Check metrics. If unverified traffic gets through, raise the reCAPTCHA risk threshold in the App Check provider settings.
- [ ] Add the numbers to `DEPLOYMENT.md`, as the plan's H9 asks.

## 10. Known gaps to schedule later

| Gap | Why it matters | Suggested fix |
| --- | --- | --- |
| No `firestore.rules` in the repo | A CLI rules deploy would wipe the console rules | Copy the console rules into `firestore.rules`, add the three deny blocks, and add `"firestore": { "rules": "firestore.rules" }` to `firebase.json` |
| No browser test for AI answers | The production build has them off, so `e2e/` can't see them | When turning on, add a stubbed `askAssistant` route in `e2e/fixtures.ts` and cover pending, answer, unavailable and reload |
| Only the current data version is accepted | After a JSON change, visitors with an old page open get "Reload the page" for AI questions | Accept, or bundle the previous version too |
| Name check rejects correct negatives | "Kubernetes isn't listed for SkyDreamer" is rejected and shown as unavailable | Decide after the evaluation shows how often it happens |
| Firebase emulator never run | The function was tested with stubs and a bundle load, not the emulator | Optional: `npm --prefix functions run serve` (needs Java) |
| Prices are hard-coded | The cost estimate drifts if Vertex prices change | Update `PRICE_MICROS_PER_TOKEN` when you confirm them (§4.4) |

## 11. If something goes wrong

1. Firestore `assistantConfig/runtime.enabled = false`. Within 30 seconds every AI request answers "unavailable", and visitors see the normal fallback with Contact.
2. Deploy the site with `assistantHosted.enabled: false`. No AI requests at all.
3. If needed, remove `roles/aiplatform.user` from `assistant-fn@…`, or disable the model in Model Garden.

The local assistant keeps working through all three steps.

## Checklist

- [ ] §1 PR reviewed and merged
- [ ] §2 Decisions confirmed or changed
- [ ] §3 Notes written, humanized, validated
- [ ] §4 Blaze, Firestore rules/TTL, Vertex AI + Claude Haiku 5.5 on `eu`, service account, secret, budget topic, function deployed with the switch off
- [ ] §5 Tried locally, switch back off
- [ ] §6 Evaluation approved, run and passed
- [ ] §7 Copy reviewed, humanized, retention wording settled
- [ ] §8 Switch on, flag on, site deployed, live check in both languages
- [ ] §9 Two weeks of monitoring noted in `DEPLOYMENT.md`
