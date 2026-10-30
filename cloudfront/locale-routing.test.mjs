// Runs cloudfront/locale-routing.js the way CloudFront does (a plain script defining handler).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./locale-routing.js", import.meta.url), "utf8");
const handler = new Function(`${source}\nreturn handler;`)();
const route = uri => handler({ request: { uri, querystring: {}, headers: {} } });

test("serves each locale's shell for its root and app routes", () => {
  for (const [uri, rewritten] of [
    ["/en/", "/en/index.html"],
    ["/pt/", "/pt/index.html"],
    ["/pt/assistant", "/pt/index.html"],
    ["/en/page-not-found", "/en/index.html"],
    ["/pt/some/deep/route", "/pt/index.html"]
  ]) {
    assert.equal(route(uri).uri, rewritten, uri);
  }
});

test("redirects a bare locale to its folder", () => {
  for (const locale of ["en", "pt"]) {
    const response = route(`/${locale}`);
    assert.equal(response.statusCode, 301);
    assert.equal(response.headers.location.value, `/${locale}/`);
  }
});

test("leaves files and paths outside the locales untouched", () => {
  for (const uri of ["/", "/index.html", "/pt/index.html", "/pt/main-ABC123.js", "/en/assets/data/about.json",
    "/en/assets/cv-english-guilherme-bastos-v2.0.pdf", "/de/", "/english/"]) {
    assert.equal(route(uri).uri, uri, uri);
  }
});
