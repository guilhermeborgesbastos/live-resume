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
# Scripts, styles and media/ must have content hashes in their names (production
# configuration, outputHashing "all"): browsers cache them for a year, and a fixed name
# such as polyfills.js would let a cached file from an older build run against a newer
# main.js. HTML and the rest (assets/, robots.txt, sitemap.xml) are uploaded no-cache,
# so browsers revalidate them on every visit and always pick up the current bundle names.
#
# After the upload, every CloudFront distribution in front of the bucket (one for
# guilhermeborgesbastos.com, one for www.) is invalidated (/*): their edges otherwise
# keep serving the previous index.html and bundles, which reference files the new
# build no longer has.
#
# Usage:
#   ./deploy.sh               build, stage into dist/site/, publish (empties the bucket
#                             first!) and invalidate; needs the CloudFront distribution IDs,
#                             separated by spaces, in CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID
#   ./deploy.sh --stage-only  build and stage into dist/site/ without touching S3 or
#                             CloudFront
set -euo pipefail

STAGE_ONLY=false
[ "${1:-}" = "--stage-only" ] && STAGE_ONLY=true

read -r -a DISTRIBUTION_IDS <<< "${CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID:-}"
if [ "$STAGE_ONLY" = false ] && [ "${#DISTRIBUTION_IDS[@]}" -eq 0 ]; then
  echo "Set CLOUDFRONT_LIVERESUME_DISTRIBUTION_ID to the distributions serving the site; nothing was built or published." >&2
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
  unhashed=$(find "$build_dir" \( -name '*.js' -o -name '*.css' -o -path '*/media/*' \) -type f \
    | grep -Ev -- '-[A-Z0-9]{8}\.[a-z0-9]+$' || true)
  if [ -n "$unhashed" ]; then
    echo "These files in $build_dir have no content hash in their name; nothing was published:" >&2
    echo "$unhashed" >&2
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
IMMUTABLE="public, max-age=31536000, immutable"
for locale in "${LOCALES[@]}"; do
  aws s3 cp "$SITE_DIR/$locale" "$BUCKET/$locale" --recursive --cache-control "$IMMUTABLE" \
    --exclude '*' --include '*.js' --include '*.css' --include 'media/*'
  aws s3 cp "$SITE_DIR/$locale" "$BUCKET/$locale" --recursive --cache-control no-cache \
    --exclude '*.js' --exclude '*.css' --exclude 'media/*'
done
aws s3 cp "$SITE_DIR/index.html" "$BUCKET/index.html" --cache-control no-cache

# Invalidate every distribution even if one fails, then report the ones that did.
failed=()
for distribution_id in "${DISTRIBUTION_IDS[@]}"; do
  if ! invalidation=$(aws cloudfront create-invalidation \
    --distribution-id "$distribution_id" \
    --paths '/*' \
    --query 'Invalidation.[Id,Status]' \
    --output text); then
    failed+=("$distribution_id")
    continue
  fi
  echo "$distribution_id  $invalidation"
done
if [ "${#failed[@]}" -gt 0 ]; then
  echo "The site was published, but invalidating ${failed[*]} failed; invalidate /* on it before relying on the new version." >&2
  exit 1
fi
