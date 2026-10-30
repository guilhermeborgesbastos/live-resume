# Deploying to AWS

`deploy.sh` publishes the site to the S3 bucket behind https://guilhermeborgesbastos.com and
clears the cache of the CloudFront distributions in front of it. This guide covers the one-time AWS setup (CLI,
IAM permissions, credentials) and then each deploy.

| Resource | Value |
| --- | --- |
| S3 bucket | `www.guilhermeborgesbastos.com` (region `eu-central-1`) |
| CloudFront distributions | `E2FO2ELLS8J6VG` and `E14O8X5D7XL2SZ` (one for `guilhermeborgesbastos.com`, one for `www.`), read from `CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID` |
| Public URLs | https://guilhermeborgesbastos.com/ (English), `/en/`, `/pt/index.html` |

> **The deploy empties the bucket before uploading.** Never run `./deploy.sh` without
> `--stage-only` unless you mean to replace production.

## What the script does

1. Stops right away if `CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID` is not set (skipped with `--stage-only`).
2. Deletes `./dist` and builds both locales (`npm run build-locale`, which uses the `production`
   configuration, so scripts, styles and `media/` files get content hashes in their names, e.g.
   `main-FNCGJIU4.js`).
3. Stages the bucket's layout in `dist/site/`:

   | Staged file | Bucket key | Served at |
   | --- | --- | --- |
   | `dist/site/en/` (from `dist/en/browser/en/`) | `en/…` | `/en/` |
   | `dist/site/pt/` (from `dist/pt/browser/pt/`) | `pt/…` | `/pt/index.html` |
   | `dist/site/index.html` (copy of `en/index.html`, absolute `og:image`) | `index.html` | `/` |

   It stops before touching AWS if a locale's `index.html` is missing, a script, style or
   `media/` file has no content hash in its name, or the root page cannot be generated.
4. With `--stage-only`, it exits here.
5. Empties the bucket (`aws s3 rm --recursive`), uploads `en/`, `pt/` and the root
   `index.html` (`aws s3 cp`) with a `Cache-Control` header:

   | Files | `Cache-Control` | Why |
   | --- | --- | --- |
   | `*.js`, `*.css`, `media/*` (all hashed) | `public, max-age=31536000, immutable` | a new build has new names, so a cached copy is never stale |
   | `*.html`, `assets/*`, `robots.txt`, `sitemap.xml` | `no-cache` | browsers revalidate on every visit, so they always get the current bundle names and content |
6. Invalidates `/*` on each CloudFront distribution and prints `<distribution> <invalidation ID> <status>`
   per distribution. If one fails, it still tries the others, then exits with an error naming the
   ones that failed. The upload has already happened by then.

## One-time setup

### 1. Install the AWS CLI v2

```bash
sudo pacman -S aws-cli-v2      # Arch / Omarchy
aws --version                  # expect aws-cli/2.x
```

Other systems: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

### 2. Create a deploy-only IAM user and policy

Don't deploy with the root account or an administrator. Create an IAM user that can only
do what the script needs:

| Script step | AWS call | Permission | Resource |
| --- | --- | --- | --- |
| Empty the bucket | `aws s3 rm --recursive` (lists, then deletes) | `s3:ListBucket` | the bucket |
| | | `s3:DeleteObject` | objects in the bucket |
| Upload the site | `aws s3 cp` (large files upload in parts) | `s3:PutObject`, `s3:AbortMultipartUpload` | objects in the bucket |
| Clear the cache | `aws cloudfront create-invalidation` | `cloudfront:CreateInvalidation` | both distributions |
| Check on an invalidation (optional) | `aws cloudfront get-invalidation` / `list-invalidations` | `cloudfront:GetInvalidation`, `cloudfront:ListInvalidations` | both distributions |

The script doesn't set ACLs, so `s3:PutObjectAcl` isn't needed.

Save the policy as `live-resume-deploy-policy.json`. The CloudFront ARNs have `*` where the account
ID would go. Distribution IDs are unique across all AWS accounts, so the statement still covers
only `E2FO2ELLS8J6VG` and `E14O8X5D7XL2SZ`, and the policy can be pasted as it is:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListSiteBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::www.guilhermeborgesbastos.com"
    },
    {
      "Sid": "WriteSiteObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"],
      "Resource": "arn:aws:s3:::www.guilhermeborgesbastos.com/*"
    },
    {
      "Sid": "InvalidateSiteCache",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": [
        "arn:aws:cloudfront::*:distribution/E2FO2ELLS8J6VG",
        "arn:aws:cloudfront::*:distribution/E14O8X5D7XL2SZ"
      ]
    }
  ]
}
```

Create the user and attach the policy. In the IAM console: **Users → Create user**
(`live-resume-deployer`, no console access) **→ Add permissions → Create inline policy →
JSON**, paste the policy. Or with the CLI, signed in as an administrator:

```bash
aws iam create-user --user-name live-resume-deployer
aws iam put-user-policy \
  --user-name live-resume-deployer \
  --policy-name live-resume-deploy \
  --policy-document file://live-resume-deploy-policy.json
```

The bucket policy must not deny this user. A bucket policy that only grants CloudFront
read access, which is the usual setup, is fine because the user's IAM policy grants the writes.

### 3. Create an access key and a CLI profile

```bash
aws iam create-access-key --user-name live-resume-deployer   # or IAM console → user → Security credentials
aws configure --profile live-resume
#   AWS Access Key ID:     <AccessKeyId from above>
#   AWS Secret Access Key: <SecretAccessKey from above>
#   Default region name:   eu-central-1
#   Default output format: json
```

The keys go in `~/.aws/credentials`. Never commit them or put them in `.env` files in this repo.
To rotate them, create a new key, run `aws configure --profile live-resume` again, then
delete the old key.

### 4. Set the CloudFront distribution IDs

`deploy.sh` reads the IDs from `CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID`, separated by spaces. It
is exported in `~/.bashrc`:

```bash
export CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID="E2FO2ELLS8J6VG E14O8X5D7XL2SZ"
```

Open a new terminal (or `source ~/.bashrc`) after changing it, and restart the IDE if you
deploy from its terminal. The IDs are in the CloudFront console, next to the distributions
whose alternate domain names are `guilhermeborgesbastos.com` and `www.guilhermeborgesbastos.com`.
A distribution added in front of the bucket later needs its ID here and its ARN in the policy.

### 5. Verify the permissions before the first deploy

These commands only read, so they're safe to run anytime:

```bash
export AWS_PROFILE=live-resume
aws sts get-caller-identity                                    # shows .../user/live-resume-deployer
aws s3 ls s3://www.guilhermeborgesbastos.com/                  # s3:ListBucket → lists en/, pt/, index.html
for id in $CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID; do                # reaches each distribution
  aws cloudfront list-invalidations --distribution-id "$id" --max-items 1 > /dev/null && echo "$id ok"
done
```

To check the write permissions without writing anything, have an administrator run the
IAM policy simulator. Every result should be `allowed`:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam simulate-principal-policy \
  --policy-source-arn "arn:aws:iam::$ACCOUNT_ID:user/live-resume-deployer" \
  --action-names s3:PutObject s3:DeleteObject \
  --resource-arns "arn:aws:s3:::www.guilhermeborgesbastos.com/en/index.html" \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
aws iam simulate-principal-policy \
  --policy-source-arn "arn:aws:iam::$ACCOUNT_ID:user/live-resume-deployer" \
  --action-names cloudfront:CreateInvalidation \
  --resource-arns "arn:aws:cloudfront::$ACCOUNT_ID:distribution/E2FO2ELLS8J6VG" \
                  "arn:aws:cloudfront::$ACCOUNT_ID:distribution/E14O8X5D7XL2SZ" \
  --query 'EvaluationResults[].[EvalActionName,EvalDecision]' --output table
```

## Deploying

1. Start from an up-to-date `master` with a clean working tree. The script deploys whatever
   is checked out, uncommitted changes included.

   ```bash
   git switch master && git pull && git status
   ```

2. Install dependencies and run the browser suite, the same gate CI uses:

   ```bash
   npm ci
   npm run test:e2e
   ```

3. Stage without publishing and look at the result:

   ```bash
   ./deploy.sh --stage-only
   ls dist/site            # en/  index.html  pt/
   ```

4. Publish:

   ```bash
   AWS_PROFILE=live-resume ./deploy.sh
   ```

   The last lines are the invalidations, one per distribution, e.g.
   `E2FO2ELLS8J6VG  I2J0I21PCUYOKT5JK8FP0N1QXQ    InProgress`.

5. Wait for the invalidations to finish (usually a few minutes) and check both domains:

   ```bash
   AWS_PROFILE=live-resume aws cloudfront wait invalidation-completed \
     --distribution-id <distribution-id> --id <invalidation-id>    # once per line printed above
   for host in guilhermeborgesbastos.com www.guilhermeborgesbastos.com; do
     for p in / /en/ /en/index.html /pt/index.html; do
       curl -s -o /dev/null -w "%{http_code} $host$p\n" "https://$host$p"
     done
   done
   ```

   Then open https://guilhermeborgesbastos.com/en/ and `/pt/index.html` in a private window.

### Rolling back

Nothing keeps the previous files, because the bucket is emptied on every deploy. To roll back,
deploy the last good commit or tag again. Use the current `deploy.sh`: versions older than this
guide (for example `v2.0.0`) have a script that doesn't upload the root `index.html` or
invalidate CloudFront.

```bash
git switch --detach v2.0.0
git restore --source master deploy.sh
npm ci && AWS_PROFILE=live-resume ./deploy.sh
git restore deploy.sh && git switch master
```

## Contact form captcha (Firebase App Check)

The contact form writes straight to Firestore from the browser, so the protection has to be
enforced by Firebase: App Check with reCAPTCHA Enterprise makes Firestore reject writes that
don't come from a visitor on the site, including bots that skip the form. Visitors see no
challenge, only the reCAPTCHA notice under the Send button. While `recaptchaSiteKey` is empty,
App Check is off and the form works as before.

Google now sells reCAPTCHA Enterprise as **Google Cloud Fraud Defense**. App Check no longer
registers classic reCAPTCHA v3 keys ("reCAPTCHA Classic is deprecated"), and a v3 key from
https://www.google.com/recaptcha/admin fails the token exchange with `App not registered`.

Do the steps in this order. Enforcing before the site key is deployed rejects every message.

1. In the Google Cloud console for project `live-resume-a575a`, open **Fraud Defense**
   (reCAPTCHA), enable the API if asked, and create a **Web** key: add the domain
   `guilhermeborgesbastos.com` (and `localhost` to test with `npm run start:en`; Google advises
   a separate key for that), and leave the **checkbox challenge off** (App Check needs a
   score-based key).
2. In the Firebase console, **App Check → Apps**, register the web app
   (`1:681076751855:web:18bae3866ebfcc4fcd8a1a`) with the **reCAPTCHA Enterprise** provider and
   that key's ID.
3. Put the key ID in `recaptchaSiteKey` in `src/environments/environment.ts` and
   `environment.prod.ts`, then deploy.
4. Send a message from the live site. In **App Check → APIs → Cloud Firestore**, the requests
   should show as verified. Until the deploy, the site in production sends no tokens, so its
   requests count as unverified.
5. Click **Enforce** for Cloud Firestore. From then on, writes without a valid App Check token
   fail, and the form shows its error message. **Unenforce** turns it off again at once.

## AI answers (Firebase)

The CV assistant answers the questions it recognizes in the browser. The ones it can't answer
can go to the `askAssistant` Cloud Function, which asks Claude Haiku 5.5 on the Claude API to
write a short answer from the CV and the notes in `src/assets/data/assistant-context.txt`,
checks it, and returns it with its sources. The function, its limits and App Check run in the
Firebase project `live-resume-a575a`; the model call goes to Anthropic with an API key; AWS only
serves the static site. What the AI may use, and how to add notes, is in
[`docs/ai-assistant-data.md`](docs/ai-assistant-data.md).

Two switches keep it off until you turn it on: `assistantHosted.enabled` in
`src/environments/environment*.ts` (the site sends nothing while it's `false`) and the Firestore
document `assistantConfig/runtime` (the function answers "unavailable" unless `enabled` is
`true`; a missing document counts as off).

### One-time setup

Do these in order. Nothing costs money until the last steps turn the feature on.

1. **Blaze plan.** Cloud Functions and Secret Manager need the pay-as-you-go plan
   (Firebase console → Usage and billing).
2. **Firestore rules.** The rules live in `firestore.rules` (wired up in `firebase.json`). They
   allow one thing: the contact form creating a message in `contacts` with exactly its four
   fields. Everything else is denied, including `assistantUsage`, `assistantRate`,
   `assistantQuestions` and `assistantConfig`, which the functions write through the Admin SDK
   (not bound by the rules).
   The rules the project had before (`allow write: if true` on every document) would have let
   any visitor reset the assistant's limits or flip its kill switch, so publish these before
   turning AI answers on:

   ```bash
   npm run test:rules                                      # emulator check: 12 allowed/denied cases
   firebase deploy --only firestore:rules --project live-resume-a575a
   ```

   Then send yourself a message through the live contact form to confirm it still arrives. The
   console's Rules tab keeps the earlier versions if you ever need to roll back. From now on,
   change the rules in the file, not in the console: a deploy replaces whatever the console holds.
3. **TTL for the rate-limit keys and the kept questions.** Firestore → TTL policies, field
   `expireAt`, once for the collection group `assistantRate` and once for `assistantQuestions`
   (or `gcloud firestore fields ttls update expireAt --collection-group=<group> --enable-ttl`).
   Firestore then deletes each rate-limit key about 48 hours after it was written, and each kept
   question 90 days after it was asked.
4. **Claude API key.** The Claude API is separate from a Claude.ai (Pro or Max) subscription.
   - In the Claude Console (https://platform.claude.com), create an account or organization,
     add a payment method and a small prepaid credit balance (a few dollars lasts months here).
   - Create a workspace for this site (for example `live-resume`) and give it a **monthly spend
     limit**, for example $20. Anthropic enforces it: past the limit, calls fail and visitors
     see "AI answers aren't available right now". The Google Cloud budget in step 7 doesn't see
     this spend.
   - Create an API key in that workspace and store it as a function secret:
     `firebase functions:secrets:set ANTHROPIC_API_KEY` (paste the key). It lives in Secret
     Manager, is readable only by the functions, and never reaches the browser or the repo.
   - Compare Anthropic's current prices with `TARIFFS` in `functions/src/core/pricing.ts`
     (Claude Haiku 5.5: $0.10 / $0.50 per million input / output tokens). The monthly cap uses
     those prices; a model without an entry there stops the function from starting rather than
     being priced by guess.
   - Questions are processed by Anthropic, not in Google Cloud, and may be processed outside the
     EU. The assistant page no longer explains this, so say it in your privacy notice, together
     with the 90 days for which questions and answers are kept (see Monitoring).
5. **Service account.** Both functions (`askAssistant` and `onBudgetAlert`) run as the account
   in `ASSISTANT_SERVICE_ACCOUNT`. Create a dedicated one and give it exactly these roles:

   ```bash
   gcloud iam service-accounts create assistant-fn --display-name="CV assistant functions"
   for role in roles/datastore.user roles/firebaseappcheck.tokenVerifier; do
     gcloud projects add-iam-policy-binding live-resume-a575a \
       --member=serviceAccount:assistant-fn@live-resume-a575a.iam.gserviceaccount.com --role=$role
   done
   ```

   **Cloud Datastore User** reads and writes the limits and lets `onBudgetAlert` turn the switch
   off, and **Firebase App Check Token Verifier** lets the callable consume single-use App Check
   tokens (without it, every visitor request fails App Check before reaching the code). Access to
   the `RATE_LIMIT_SALT` and `ANTHROPIC_API_KEY` secrets is granted by `firebase deploy` itself.
   Set `ASSISTANT_SERVICE_ACCOUNT` to `assistant-fn@live-resume-a575a.iam.gserviceaccount.com` at
   deploy. Left at `default`, both functions run as the project's default compute service
   account, which then needs the same two roles.
6. **Rate-limit salt.** `firebase functions:secrets:set RATE_LIMIT_SALT` and paste a random
   value (`openssl rand -hex 32`). The function hashes visitor IPs with it, so keep it secret.
7. **Budget backstop.** Create the Pub/Sub topic (`gcloud pubsub topics create assistant-budget`),
   then Billing → Budgets & alerts: create a budget for the project above the $20 monthly cap
   (for example $30/month) with alerts at 50%, 90% and 100%, connected to that topic. When the
   actual cost reaches the budget, `onBudgetAlert` sets `assistantConfig/runtime.enabled` to
   `false`. Billing data arrives hours late, so this is a backstop; the per-call limits below are
   what keep spending bounded. This budget only covers Google Cloud costs (functions, Firestore,
   App Check); the Claude API spend is capped by `MONTHLY_BUDGET_MICROS` and the Anthropic
   workspace's spend limit (step 4).
8. **Your name.** The model speaks as the CV's owner, named from `personal.name` and
   `personal.firstName` in `src/environments/environment.prod.ts` (the function bundles that
   file). If you run your own copy of this site, set them there; nothing else holds the name.
9. **Deploy the functions.** Install the Firebase CLI (`npm install -g firebase-tools`), run
   `firebase login`, then `npm --prefix functions run deploy`. The first deploy asks for the
   parameters below and stores your answers in `functions/.env.live-resume-a575a`.

   After the first deploy, let the budget alerts reach `onBudgetAlert`. Its Pub/Sub trigger calls
   the function as the runtime account, and a custom account isn't allowed to invoke the
   function's Cloud Run service until you grant it (the service only exists after the deploy):

   ```bash
   gcloud run services add-iam-policy-binding onbudgetalert --region=europe-west4 \
     --project=live-resume-a575a --role=roles/run.invoker \
     --member=serviceAccount:assistant-fn@live-resume-a575a.iam.gserviceaccount.com
   ```

   Without it, every alert is rejected before the function runs, and the backstop never turns
   the switch off. The grant is on the service, so it survives later deploys.
10. **Check the deployment.**
    - App Check → APIs → Cloud Functions shows verified and unverified calls. App Check is
      enforced in code (`enforceAppCheck`, `consumeAppCheckToken`), and a replayed token is
      rejected before any work is done; there's nothing to click.
    - Test the budget backstop with the switch on, then put it back:
      `gcloud pubsub topics publish assistant-budget --message='{"costAmount":1,"budgetAmount":1}'`
      should set `assistantConfig/runtime.enabled` to `false`, with `disabledReason: "budget"`,
      within a minute. If it doesn't, the `onBudgetAlert` logs say why: "lacks
      run.routes.invoke" means the Cloud Run Invoker grant from step 9 is missing; a Firestore
      permission error means the runtime account lacks **Cloud Datastore User**. Pub/Sub keeps
      retrying the alert, so it goes through once the missing role is granted.
    - Check the per-visitor limits use your real address: ask
      `PER_CLIENT_PER_MINUTE + 1` AI questions within a minute, adding a different fake
      `X-Forwarded-For` address to each request (for example with a browser extension). The
      last one must still be refused as over the limit. If it isn't, Google's front end isn't the
      only proxy appending to that header: raise `TRUSTED_PROXY_HOPS` and redeploy.

### Turning it on

1. Run the evaluation (about 200 annotated EN/PT questions) against the deployed function with
   the switch on only for that run, and check the release gate: no answer with an unsupported
   fact, at least 90% useful answers, at least 99% valid replies, p95 latency of 5 s or less.
2. In Firestore, create `assistantConfig/runtime` with `enabled: true` (boolean).
3. Set `assistantHosted.enabled: true` in `environment.prod.ts` and `environment.ts`, run the
   browser suite, and deploy the site with `./deploy.sh`.
4. Ask a question the local assistant can't answer, in a **normal** browser window: App Check
   always fails in headless and incognito browsers, so a test there shows "AI answers aren't
   available right now".

### Limits and parameters

Set at deploy time (`functions/.env.live-resume-a575a`, or the prompts on first deploy):

| Parameter | Default | Meaning |
| --- | --- | --- |
| `MONTHLY_BUDGET_MICROS` | 20000000 | Model spend per UTC month, in millionths of a dollar ($20). Each call reserves its cost ceiling before it runs and is settled to its actual cost afterwards; a call whose cost is unknown (a timeout) keeps its reservation |
| `DAILY_CALL_LIMIT` | 400 | Model calls per UTC day, for everyone. A cache miss with the current ~10,000-token prompt (CV plus notes) costs about $0.0016, measured on the live function, so 400 × 31 days ≈ $19.80 keeps a month of full days under the $20 cap. If the notes grow, re-measure (the `usage` in the `askAssistant` logs) and lower it |
| `PER_CLIENT_PER_MINUTE` / `PER_CLIENT_PER_DAY` | 3 / 80 | Per visitor (per daily IP key). The daily figure is 4× the earlier 20, in step with the budget |
| `TRUSTED_PROXY_HOPS` | 1 | Proxies in front of the function that append to `X-Forwarded-For` (Google's front end). The visitor's address is read that many places from the right, so addresses a caller adds are ignored; a request whose address can't be found is refused |
| `ASSISTANT_MODEL` | `claude-haiku-5-5` | Claude API model ID; it needs a price in `TARIFFS` |
| `ANTHROPIC_API_KEY` (secret) | none | The Claude API key, set with `firebase functions:secrets:set ANTHROPIC_API_KEY` |
| `ASSISTANT_SERVICE_ACCOUNT` | `default` | Runtime account of both functions: an e-mail, `name@`, or `default` (the default compute account) |
| `BUDGET_TOPIC` | `assistant-budget` | Pub/Sub topic of the budget alerts |

### Monitoring

- **Firestore** `assistantUsage/<YYYY-MM-DD>`: calls, outcomes (`answered`, `unsupported`,
  `invalid`, `error`, `limited`) and token counts; `assistantUsage/<YYYY-MM>`: the month's
  spend in millionths of a dollar (settled costs plus the reservations of calls whose cost is
  unknown).
- **Firestore** `assistantQuestions`: one document per question that reached the model, with
  the question, locale, outcome, the answer's paragraphs and cited evidence IDs (or, for a
  rejected reply, the failed `check` and the reply, capped at 4,000 characters), the model,
  prompt, knowledge and notes versions, the cost in millionths of a dollar, `createdAt` and
  `expireAt` (90 days later, deleted by the TTL policy). Nothing identifies the visitor: no IP,
  rate-limit key or App Check token. Questions the browser answers itself, and questions refused
  by a limit, the kill switch or a version mismatch, are not kept. Read them in the Firebase
  console (Firestore → `assistantQuestions`, sorted by `createdAt`) to find questions worth a
  pattern, an alias or a note.
- **Cloud Logging**, function `askAssistant`: one `ask` event per question, with the result,
  the failed check if any (`number`, `name`, `guarded-topic`, …), timing and token usage;
  `replayed-token`, `unknown-client`, `invalid-request`, `record-failed` and
  `question-save-failed` events for requests that were refused or couldn't be counted or kept.
  The names are the enums in `functions/src/core/constants.ts`. Questions and answers are never
  logged; they are only in `assistantQuestions`.
- A rising `invalid` count means the model is producing answers the checks reject: look at the
  `check` field before changing the prompt.

### Changing the CV data or the notes

The function bundles its own copy of the four data files. After changing any of them:
`npm run validate:context`, then `npm --prefix functions run deploy`, then `./deploy.sh`.
In IntelliJ IDEA / WebStorm the three are run configurations (**Validate assistant notes**,
**Deploy Cloud Functions**, **Deploy site (S3)**) in `.idea/runConfigurations/`; the site deploy
one needs the `live-resume` AWS profile and runs the real, destructive `deploy.sh`.
Deploying the function first means it already knows the new data when the new pages go live.
Pages still open from before then get "Reload the page" for AI questions; a change to the notes
alone doesn't cause that.

### Rolling back

1. Set `assistantConfig/runtime.enabled` to `false` in Firestore. Within 30 seconds the function
   answers "unavailable" and visitors see the normal fallback with the Contact link.
2. Deploy the site with `assistantHosted.enabled: false`: no AI requests at all.
3. If needed, revoke the API key in the Claude Console, or set the workspace's spend limit to
   $0.

The local assistant, its suggestions and the Contact link keep working through every step.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Set CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID …` | The variable isn't in this shell | `source ~/.bashrc`, or prefix the command with it |
| `Unable to locate credentials` | No profile selected or configured | `aws configure --profile live-resume`, run with `AWS_PROFILE=live-resume` |
| `AccessDenied` on `ListObjectsV2` | `s3:ListBucket` missing or set on `…/*` instead of the bucket ARN | Fix the `ListSiteBucket` statement |
| `AccessDenied` on `DeleteObject` / `PutObject` | Object permissions missing, or the bucket policy denies the user | Fix `WriteSiteObjects`, check the bucket policy |
| `AccessDenied` on `CreateInvalidation` | The distribution's ARN is missing from the policy, or its ID is wrong | Compare the policy's ARNs with the IDs in the CloudFront console |
| `NoSuchDistribution` | `CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID` holds a wrong ID | Copy the IDs from the CloudFront console |
| `… invalidating <id> failed` after the upload | The site is published, but that distribution still serves the old version | Fix the cause, then `aws cloudfront create-invalidation --distribution-id <id> --paths '/*'` |
| Blank page right after a deploy, on one domain or both | Old cached `index.html` or bundles at the edge | Wait for the invalidations to complete, then reload |
| Blank page with `NG0908` in the console | The browser ran a cached script from an older build next to the new `main` bundle (happened on 2026-10-21, when bundles had fixed names like `polyfills.js` and no `Cache-Control`) | Hashed names prevent it. If a build ever ships unhashed bundles again, the deploy refuses to publish them |
| Failure after `aws s3 rm` | The site is empty or partly uploaded | Fix the cause and run `./deploy.sh` again; it starts over |

## Known limitations

- **The site is down for the length of the upload.** The bucket is emptied first, and
  `aws s3 sync --delete` per locale would avoid that.
- **`/pt/` shows the English site.** CloudFront serves `/en/index.html` for any missing key,
  including the `pt/` "folder", so only `/pt/index.html` shows Portuguese. The header's
  language links use `/pt/index.html`. Fixing it takes a CloudFront Function that rewrites
  `/<locale>/` to `/<locale>/index.html`.
- **Browsers that cached the 2022 page can still show it.** Before 2026-10-21, files were
  served without `Cache-Control`, so a browser may hold the old `index.html` for weeks based
  on its age. That page loads `runtime.js`, which no longer exists. Pages uploaded since then
  are `no-cache`, so this only affects copies cached before the fix.
