// Minimal static server for the localized production builds used by the Playwright suite.
// It follows the same contract as the Docker image's Nginx config (docker/nginx.conf):
// `/en` and `/pt` redirect to `/en/` and `/pt/`, each locale serves its own build, unknown
// non-file paths fall back to the locale's index.html (so the Angular router can render
// the 404 page), missing files return a real 404 so broken assets fail the suite, and
// nothing is served outside the locale prefixes.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.E2E_PORT || 4300);
const distRoot = resolve(process.env.E2E_DIST || "dist");
const locales = ["en", "pt"];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

async function sendFile(res, filePath) {
  const body = await readFile(filePath);
  res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
  res.end(body);
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const [, locale] = pathname.split("/");

    if (!locales.includes(locale)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    if (pathname === `/${locale}`) {
      res.writeHead(301, { Location: `/${locale}/` });
      res.end();
      return;
    }

    const localeRoot = join(distRoot, locale, "browser", locale);
    const relativePath = normalize(decodeURIComponent(pathname.slice(locale.length + 2)));
    const filePath = join(localeRoot, relativePath);

    if (!filePath.startsWith(localeRoot)) {
      res.writeHead(403);
      res.end();
      return;
    }

    if (await isFile(filePath)) {
      await sendFile(res, filePath);
    } else if (extname(relativePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    } else {
      await sendFile(res, join(localeRoot, "index.html"));
    }
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${distRoot} on http://127.0.0.1:${port} (locales: ${locales.join(", ")})`);
});
