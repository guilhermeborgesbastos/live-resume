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
