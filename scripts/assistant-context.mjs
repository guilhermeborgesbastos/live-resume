#!/usr/bin/env node
// Validates src/assets/data/assistant-context.txt, the notes the hosted AI answers may use.
//
//   node scripts/assistant-context.mjs validate        (npm run validate:context)
//
// The rules live in src/app/assistant/knowledge/assistant-context.ts, shared with the Cloud
// Function and the unit specs; Node runs that TypeScript file directly (type stripping, Node 22.18+).
// Exit code is 1 on any error; warnings (notes over 12 months old) don't fail.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAssistantContext } from "../src/app/assistant/knowledge/assistant-context.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "src/assets/data");

function validate() {
  const experiences = JSON.parse(readFileSync(join(DATA, "experiences.json"), "utf8"));
  const now = new Date();
  const { notes, errors, warnings } = parseAssistantContext(readFileSync(join(DATA, "assistant-context.txt"), "utf8"), {
    today: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 },
    experienceIds: experiences.map(experience => experience.id)
  });
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  if (errors.length) return false;
  console.log(`assistant-context.txt: ${notes.length} note(s) OK`);
  return true;
}

const commands = { validate };
const command = process.argv[2];
if (!commands[command]) {
  console.error("usage: assistant-context.mjs validate");
  process.exit(1);
}
process.exit(commands[command]() ? 0 : 1);
