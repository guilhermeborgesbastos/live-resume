#!/usr/bin/env node
// Bundles the Cloud Functions into lib/index.js and copies the CV data they answer from into
// lib/data/. The shared assistant code under ../src/app/assistant is bundled in; the Firebase,
// Admin and Anthropic packages stay external (installed from package.json at deploy).
// Fails if the notes file doesn't validate, so a bad note never reaches production.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const LIB = join(HERE, "lib");
const DATA_FILES = ["about.json", "experiences.json", "posts.json", "assistant-context.txt"];

execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(ROOT, "scripts/assistant-context.mjs"), "validate"], { stdio: "inherit" });

rmSync(LIB, { recursive: true, force: true });
await build({
  entryPoints: [join(HERE, "src/index.ts")],
  outfile: join(LIB, "index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  sourcemap: true,
  logLevel: "warning",
  // Shared modules are reached by relative paths into ../src, which "packages: external" leaves bundled.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }
});

mkdirSync(join(LIB, "data"), { recursive: true });
for (const file of DATA_FILES) {
  copyFileSync(join(ROOT, "src/assets/data", file), join(LIB, "data", file));
}
console.log(`functions: bundled lib/index.js and ${DATA_FILES.length} data files`);
