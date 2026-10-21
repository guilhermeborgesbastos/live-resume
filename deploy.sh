#!/bin/bash
# Builds both locales and publishes them to the S3 website bucket:
#
#   dist/en/browser/en/  ->  s3://www.guilhermeborgesbastos.com/en/  (https://guilhermeborgesbastos.com/en/)
#   dist/pt/browser/pt/  ->  s3://www.guilhermeborgesbastos.com/pt/  (https://guilhermeborgesbastos.com/pt/)
#   dist/site/index.html ->  s3://www.guilhermeborgesbastos.com/index.html  (https://guilhermeborgesbastos.com/)
#
# The root index.html is a copy of the English one: its <base href="/en/"> loads the
# English app from the bucket root. Only og:image is rewritten to an absolute URL,
# because crawlers resolve it against the page URL rather than the base href. It is
# regenerated on every deploy since the scripts and fonts it references change with
# each build.
#
# The Angular application builder nests each localized build under browser/<locale>/,
# so copying dist/<locale> as a whole would publish browser/<locale>/... instead of
# the /en/ and /pt/ paths the builds' base hrefs expect.
#
# After the upload, the CloudFront distribution in front of the bucket is invalidated
# (/*): its edges otherwise keep serving the previous index.html and bundles, which
# reference files the new build no longer has.
#
# Usage:
#   CLOUDFRONT_DISTRIBUTION_ID=<id> ./deploy.sh  build, stage into dist/site/, publish
#                                                (empties the bucket first!) and invalidate
#   ./deploy.sh --stage-only                     build and stage into dist/site/ without
#                                                touching S3 or CloudFront
set -euo pipefail

STAGE_ONLY=false
[ "${1:-}" = "--stage-only" ] && STAGE_ONLY=true

if [ "$STAGE_ONLY" = false ] && [ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "Set CLOUDFRONT_DISTRIBUTION_ID to the distribution serving the site; nothing was built or published." >&2
  exit 1
fi

BUCKET="s3://www.guilhermeborgesbastos.com"
SITE_URL="https://www.guilhermeborgesbastos.com"
LOCALES=(en pt)
SITE_DIR="./dist/site"

rm -rf ./dist
npm run build-locale

mkdir -p "$SITE_DIR"
for locale in "${LOCALES[@]}"; do
  build_dir="./dist/$locale/browser/$locale"
  if [ ! -f "$build_dir/index.html" ]; then
    echo "Missing $build_dir/index.html; nothing was published." >&2
    exit 1
  fi
  cp -R "$build_dir" "$SITE_DIR/$locale"
done

sed 's|<meta property="og:image" content="\./assets/|<meta property="og:image" content="'"$SITE_URL"'/en/assets/|' \
  "$SITE_DIR/en/index.html" > "$SITE_DIR/index.html"
if ! grep -q "content=\"$SITE_URL/en/assets/og-image.png\"" "$SITE_DIR/index.html"; then
  echo "Could not point og:image of the root index.html at $SITE_URL/en/; nothing was published." >&2
  exit 1
fi

if [ "$STAGE_ONLY" = true ]; then
  echo "Staged ${LOCALES[*]} and the root index.html in $SITE_DIR (not published)."
  exit 0
fi

aws s3 rm "$BUCKET" --recursive
for locale in "${LOCALES[@]}"; do
  aws s3 cp "$SITE_DIR/$locale" "$BUCKET/$locale" --recursive
done
aws s3 cp "$SITE_DIR/index.html" "$BUCKET/index.html"

aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths '/*' \
  --query 'Invalidation.[Id,Status]' \
  --output text
