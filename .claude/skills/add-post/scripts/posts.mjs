#!/usr/bin/env node
// Validates src/assets/data/posts.json and inserts new post records into it.
//
//   node .claude/skills/add-post/scripts/posts.mjs validate
//   node .claude/skills/add-post/scripts/posts.mjs add <record.json> [--dry-run]
//
// `add` checks the record with the strict rules for new posts, inserts it so the list stays
// newest-first, and rewrites the file in its existing format (4-space indent, trailing newline,
// non-ASCII characters kept as-is). Exit code is 1 on any error.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const POSTS_FILE = join(ROOT, "src/assets/data/posts.json");
const LANGUAGES = ["en", "pt"];
const KEYS = ["thumbnail", "http", "date", "internationalizations"];
const ALLOWED_TAGS = ["b", "i"];
const PLACEHOLDER = "assets/posts/thumbnail-placeholder.png";
// posts-carousel.component.html cuts descriptions at 275 characters of the raw string (tags included).
const DESCRIPTION_LIMIT = 275;

function parseDate(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? "");
  if (!match) return null;
  const [, month, day, year] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? year * 10000 + month * 100 + day : null;
}

function checkMarkup(text) {
  const problems = [];
  const stack = [];
  for (const [, closing, name] of text.matchAll(/<(\/?)([a-zA-Z0-9]*)[^>]*>/g)) {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) {
      problems.push(`tag <${closing}${name}> is not allowed (use only ${ALLOWED_TAGS.map(t => `<${t}>`).join(", ")})`);
    } else if (!closing) {
      stack.push(tag);
    } else if (stack.pop() !== tag) {
      problems.push(`</${tag}> does not close the last opened tag`);
    }
  }
  if (stack.length) problems.push(`unclosed tag(s): ${stack.map(t => `<${t}>`).join(", ")}`);
  if (/<(?![\/a-zA-Z])|<[^>]*$/.test(text)) problems.push("contains a stray '<'");
  return problems;
}

// Returns { errors, warnings } for one record. `strict` applies the rules for new posts.
function checkRecord(post, label, strict) {
  const errors = [];
  const warnings = [];
  const error = message => errors.push(`${label}: ${message}`);
  const warn = message => warnings.push(`${label}: ${message}`);

  if (!post || typeof post !== "object" || Array.isArray(post)) {
    error("must be an object");
    return { errors, warnings };
  }
  for (const key of KEYS) if (!(key in post)) error(`missing "${key}"`);
  for (const key of Object.keys(post)) if (!KEYS.includes(key)) error(`unknown key "${key}"`);

  if (parseDate(post.date) === null) error(`date "${post.date}" must be a real date in MM-DD-YYYY format`);

  try {
    if (new URL(post.http).protocol !== "https:") error(`http "${post.http}" must use https`);
  } catch {
    error(`http "${post.http}" is not a valid URL`);
  }

  if (typeof post.thumbnail !== "string" || !post.thumbnail.startsWith("assets/posts/")) {
    error(`thumbnail "${post.thumbnail}" must be a path under assets/posts/`);
  } else if (!existsSync(join(ROOT, "src", post.thumbnail))) {
    error(`thumbnail file src/${post.thumbnail} does not exist`);
  }

  const entries = Array.isArray(post.internationalizations) ? post.internationalizations : [];
  if (!Array.isArray(post.internationalizations)) error("internationalizations must be an array");
  for (const language of LANGUAGES) {
    const matches = entries.filter(entry => entry?.language === language);
    if (matches.length !== 1) error(`needs exactly one "${language}" entry, found ${matches.length}`);
  }
  for (const entry of entries) {
    if (!LANGUAGES.includes(entry?.language)) {
      error(`unsupported language "${entry?.language}"`);
      continue;
    }
    for (const field of ["title", "description"]) {
      const text = entry[field];
      if (typeof text !== "string" || !text.trim()) {
        error(`${entry.language}.${field} must be a non-empty string`);
        continue;
      }
      if (text !== text.trim()) error(`${entry.language}.${field} has leading or trailing whitespace`);
      for (const problem of checkMarkup(text)) error(`${entry.language}.${field} ${problem}`);
    }
    const unknown = Object.keys(entry).filter(key => !["language", "title", "description"].includes(key));
    if (unknown.length) error(`${entry.language} entry has unknown key(s): ${unknown.join(", ")}`);
    const length = typeof entry.description === "string" ? entry.description.length : 0;
    if (length > DESCRIPTION_LIMIT) {
      (strict ? error : warn)(`${entry.language}.description is ${length} characters; the card cuts it at ${DESCRIPTION_LIMIT}`);
    }
  }
  return { errors, warnings };
}

function checkList(posts) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(posts)) return { errors: ["posts.json must contain an array"], warnings };
  posts.forEach((post, index) => {
    const result = checkRecord(post, `posts[${index}] (${post?.date ?? "no date"})`, false);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });
  for (const key of ["http", "thumbnail"]) {
    const seen = new Map();
    posts.forEach((post, index) => {
      if (post?.[key] === PLACEHOLDER) return;
      if (seen.has(post?.[key])) errors.push(`posts[${index}]: duplicate ${key} "${post[key]}" (also posts[${seen.get(post[key])}])`);
      else seen.set(post?.[key], index);
    });
  }
  return { errors, warnings };
}

function readPosts() {
  return JSON.parse(readFileSync(POSTS_FILE, "utf8"));
}

function report({ errors, warnings }) {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  return errors.length === 0;
}

function validate() {
  const posts = readPosts();
  const ok = report(checkList(posts));
  if (ok) console.log(`posts.json is valid (${posts.length} posts)`);
  return ok;
}

function add(recordPath, dryRun) {
  if (!recordPath) {
    console.error("usage: posts.mjs add <record.json> [--dry-run]");
    return false;
  }
  const record = JSON.parse(readFileSync(resolve(recordPath), "utf8"));
  if (!report(checkRecord(record, "new post", true))) return false;

  const posts = readPosts();
  const newDate = parseDate(record.date);
  // Keep newest-first: go before the first post that is older than the new one.
  let index = posts.findIndex(post => (parseDate(post.date) ?? 0) < newDate);
  if (index === -1) index = posts.length;
  posts.splice(index, 0, record);

  // Older posts may exceed the description limit; only their errors matter here.
  if (!report({ errors: checkList(posts).errors, warnings: [] })) return false;
  if (dryRun) {
    console.log(`dry run: the post would be inserted at index ${index} of ${posts.length}`);
    return true;
  }
  writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 4) + "\n");
  console.log(`added "${record.internationalizations.find(e => e.language === "en").title}" at index ${index} of ${posts.length}`);
  return true;
}

const [command, ...args] = process.argv.slice(2);
const commands = {
  validate: () => validate(),
  add: () => add(args.find(arg => !arg.startsWith("--")), args.includes("--dry-run")),
};
if (!commands[command]) {
  console.error("usage: posts.mjs validate | posts.mjs add <record.json> [--dry-run]");
  process.exit(1);
}
process.exit(commands[command]() ? 0 : 1);
