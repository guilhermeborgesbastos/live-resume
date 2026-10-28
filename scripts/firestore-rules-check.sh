#!/usr/bin/env bash
# Exercises firestore.rules in the Firestore emulator through its REST API, as an unauthenticated
# visitor: the contact form may create a message, and nothing else may be read or written.
#
#   npm run test:rules   (needs firebase-tools and Java; starts and stops the emulator itself)
set -u
BASE="http://127.0.0.1:8085/v1/projects/live-resume-a575a/databases/(default)/documents"
DATE='"date":{"timestampValue":"2026-10-28T12:00:00Z"}'
MSG='"name":{"stringValue":"Ada"},"email":{"stringValue":"ada@example.com"},"message":{"stringValue":"Hello"}'
fail=0

expect() { # expect <label> <wanted status> <curl args...>
  local label=$1 wanted=$2; shift 2
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$got" = "$wanted" ]; then echo "ok   $label ($got)"; else echo "FAIL $label (wanted $wanted, got $got)"; fail=1; fi
}

expect "create a contact message"            200 -X POST "$BASE/contacts?documentId=m1" -H 'Content-Type: application/json' -d "{\"fields\":{$MSG,$DATE}}"
expect "create with an extra field"          403 -X POST "$BASE/contacts?documentId=m2" -H 'Content-Type: application/json' -d "{\"fields\":{$MSG,$DATE,\"admin\":{\"booleanValue\":true}}}"
expect "create without a date"               403 -X POST "$BASE/contacts?documentId=m3" -H 'Content-Type: application/json' -d "{\"fields\":{$MSG}}"
expect "overwrite a contact message"         403 -X PATCH "$BASE/contacts/m1" -H 'Content-Type: application/json' -d "{\"fields\":{$MSG,$DATE}}"
expect "read a contact message"              403 "$BASE/contacts/m1"
expect "delete a contact message"            403 -X DELETE "$BASE/contacts/m1"
expect "turn the AI kill switch on"          403 -X PATCH "$BASE/assistantConfig/runtime" -H 'Content-Type: application/json' -d '{"fields":{"enabled":{"booleanValue":true}}}'
expect "reset the daily usage counter"       403 -X PATCH "$BASE/assistantUsage/2026-10-28" -H 'Content-Type: application/json' -d '{"fields":{"calls":{"integerValue":"0"}}}'
expect "reset a visitor's rate limit"        403 -X PATCH "$BASE/assistantRate/somekey" -H 'Content-Type: application/json' -d '{"fields":{"dayCount":{"integerValue":"0"}}}'
expect "write to another collection"         403 -X POST "$BASE/anything?documentId=x" -H 'Content-Type: application/json' -d '{"fields":{"a":{"stringValue":"b"}}}'
exit $fail
