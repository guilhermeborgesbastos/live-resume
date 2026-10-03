import { test as base, expect, Page, Request, Route } from "@playwright/test";

export const LOCALES = ["en", "pt"] as const;
export type Locale = typeof LOCALES[number];

/** Translated UI strings (from src/locales/messages.*.xlf) that the suite asserts on. */
export const TEXT = {
  en: {
    nav: { about: "About me", experience: "Experiences", posts: "Posts", contact: "Contact" },
    previous: "Previous",
    next: "Next",
    readMore: "Read more",
    send: "Send",
    yearsOld: "years old",
    requiredName: "The name is required.",
    invalidName: "Please, provide a valid name.",
    requiredEmail: "The email is required.",
    invalidEmail: "Please, provide a valid email address.",
    requiredMessage: "The message is required."
  },
  pt: {
    nav: { about: "Sobre mim", experience: "Experiências", posts: "Artigos", contact: "Contato" },
    previous: "Anterior",
    next: "Próximo",
    readMore: "Saiba mais",
    send: "Enviar",
    yearsOld: "anos de idade",
    requiredName: "O nome é obrigatório.",
    invalidName: "Por favor, insira um nome válido.",
    requiredEmail: "O e-mail é obrigatório.",
    invalidEmail: "Por favor, insira um e-mail válido.",
    requiredMessage: "A mensagem é obrigatória."
  }
} as const;

export interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedFirstPartyRequests: string[];
  externalRequests: string[];
  blockedFirestoreRequests: string[];
}

const FIREBASE_PROJECT = "live-resume-a575a";
const FIREBASE_APP_ID = "1:681076751855:web:18bae3866ebfcc4fcd8a1a";
const MEASUREMENT_ID = "G-00VXD77WNG";

/** Origin of e2e/serve.mjs; must match `baseURL` in playwright.config.ts. */
const APP_ORIGIN = `http://127.0.0.1:${process.env.E2E_PORT || 4300}`;

function isFirstParty(url: string): boolean {
  return url.startsWith(`${APP_ORIGIN}/`) || url.startsWith("data:") || url.startsWith("blob:");
}

/**
 * Third-party traffic never leaves the browser: Firebase bootstrap endpoints and the
 * gtag loader get inert stubs (so analytics initializes without errors or real hits),
 * Firestore writes are recorded and aborted, and everything else external is blocked.
 */
async function stubThirdParty(route: Route, request: Request, diagnostics: BrowserDiagnostics) {
  const url = new URL(request.url());
  diagnostics.externalRequests.push(`${request.method()} ${url.origin}${url.pathname}`);

  if (url.host === "firebase.googleapis.com" && url.pathname.endsWith("/webConfig")) {
    return route.fulfill({
      json: { projectId: FIREBASE_PROJECT, appId: FIREBASE_APP_ID, measurementId: MEASUREMENT_ID }
    });
  }
  if (url.host === "firebaseinstallations.googleapis.com" && request.method() === "POST") {
    return route.fulfill({
      json: {
        name: `projects/${FIREBASE_PROJECT}/installations/e2e-stub`,
        fid: "e2e-stub-fid",
        refreshToken: "e2e-stub-refresh-token",
        authToken: { token: "e2e-stub-auth-token", expiresIn: "604800s" }
      }
    });
  }
  if (url.host === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
    return route.fulfill({ contentType: "text/javascript", body: "/* gtag stub */" });
  }
  if (url.host === "firestore.googleapis.com") {
    diagnostics.blockedFirestoreRequests.push(`${request.method()} ${url.pathname} ${request.postData() ?? ""}`);
  }
  return route.abort("blockedbyclient");
}

export const test = base.extend<{ diagnostics: BrowserDiagnostics }>({
  diagnostics: [async ({ page }, use, testInfo) => {
    const diagnostics: BrowserDiagnostics = {
      consoleErrors: [],
      pageErrors: [],
      failedFirstPartyRequests: [],
      externalRequests: [],
      blockedFirestoreRequests: []
    };

    page.on("console", message => {
      // Chrome reports every request the fixture blocks as "Failed to load resource";
      // only first-party load failures matter (and are also caught via responses below).
      const blockedThirdParty = message.text().startsWith("Failed to load resource")
        && !isFirstParty(message.location().url);
      if (message.type() === "error" && !blockedThirdParty) {
        diagnostics.consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", error => diagnostics.pageErrors.push(`${error.name}: ${error.message}`));
    page.on("response", response => {
      if (isFirstParty(response.url()) && response.status() >= 400) {
        diagnostics.failedFirstPartyRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("requestfailed", request => {
      const failure = request.failure()?.errorText ?? "";
      // Requests cancelled by an in-flight navigation are not application failures.
      if (isFirstParty(request.url()) && failure !== "net::ERR_ABORTED") {
        diagnostics.failedFirstPartyRequests.push(`${failure} ${request.url()}`);
      }
    });
    await page.route(url => !isFirstParty(url.href), (route, request) =>
      stubThirdParty(route, request, diagnostics));

    await use(diagnostics);

    await testInfo.attach("browser-diagnostics.json", {
      body: JSON.stringify(diagnostics, null, 2),
      contentType: "application/json"
    });
    expect.soft(diagnostics.pageErrors, "uncaught page errors").toEqual([]);
    expect.soft(diagnostics.consoleErrors, "console errors").toEqual([]);
    expect.soft(diagnostics.failedFirstPartyRequests, "failed first-party requests").toEqual([]);
  }, { auto: true }]
});

export { expect };

/** Loads a locale's resume page and waits until Angular has rendered the data-driven sections. */
export async function openResume(page: Page, locale: Locale, fragment = ""): Promise<void> {
  await page.goto(`/${locale}/${fragment}`);
  await expect(page.locator("app-root app-resume")).toBeVisible();
  await expect(page.locator("#experience .events-content li").first()).toBeAttached();
  await expect(page.locator("app-posts-carousel li").first()).toBeAttached();
  await expect(page.locator("#about .text")).not.toHaveText("Loading...");
}

export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) <= 1024;
}
