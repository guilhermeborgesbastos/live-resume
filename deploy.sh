#!/bin/bash
# Builds both locales and publishes them to the S3 website bucket:
#
#   dist/en/browser/en/  ->  s3://www.guilhermeborgesbastos.com/en/  (https://guilhermeborgesbastos.com/en/)
#   dist/pt/browser/pt/  ->  s3://www.guilhermeborgesbastos.com/pt/  (https://guilhermeborgesbastos.com/pt/)
#
# The Angular application builder nests each localized build under browser/<locale>/,
# so copying dist/<locale> as a whole would publish browser/<locale>/... instead of
# the /en/ and /pt/ paths the builds' base hrefs expect.
#
# Usage:
#   ./deploy.sh               build, stage into dist/site/ and publish (empties the bucket first!)
#   ./deploy.sh --stage-only  build and stage into dist/site/ without touching S3
set -euo pipefail

BUCKET="s3://www.guilhermeborgesbastos.com"
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

if [ "${1:-}" = "--stage-only" ]; then
  echo "Staged ${LOCALES[*]} in $SITE_DIR (not published)."
  exit 0
fi

aws s3 rm "$BUCKET" --recursive
for locale in "${LOCALES[@]}"; do
  aws s3 cp "$SITE_DIR/$locale" "$BUCKET/$locale" --recursive
done
