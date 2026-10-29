import { test as base, expect, Page, Request, Route } from "@playwright/test";
import { APP_ORIGIN } from "./target";

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
  /** reCAPTCHA tokens the app exchanged for App Check tokens. */
  appCheckExchanges: string[];
  /** The App Check token each Firestore request carried ("" when it had none). */
  firestoreAppCheckTokens: string[];
  /** The askAssistant Cloud Function, stubbed (builds with assistantHosted.enabled call it). */
  askAssistant: AskAssistantStub;
}

export interface AskAssistantCall {
  /** The callable's `data`: the request the site sent. */
  readonly data: any;
  /** The X-Firebase-AppCheck header ("" when it had none). */
  readonly appCheck: string;
}

export interface AskAssistantStub {
  readonly calls: AskAssistantCall[];
  /** The function's reply to each call; a test replaces it. Defaults to the "nothing in the CV" result. */
  reply: (data: any) => unknown | Promise<unknown>;
}

/** Where the site calls the askAssistant callable (functions region europe-west4). */
const ASK_ASSISTANT_HOST = "europe-west4-live-resume-a575a.cloudfunctions.net";
const ASK_ASSISTANT_PATH = "/askAssistant";

const FIREBASE_PROJECT = "live-resume-a575a";
const FIREBASE_APP_ID = "1:681076751855:web:18bae3866ebfcc4fcd8a1a";
const MEASUREMENT_ID = "G-00VXD77WNG";
export const RECAPTCHA_TOKEN = "e2e-stub-recaptcha-token";
export const APP_CHECK_TOKEN = "e2e-stub-app-check-token";

/**
 * Stands in for reCAPTCHA Enterprise (www.google.com/recaptcha/enterprise.js), as used by App Check's
 * provider: like the real widget, execute() reports success through the callback given to render(),
 * which App Check requires before it exchanges the token.
 */
const RECAPTCHA_STUB = `(() => {
  let widget;
  window.grecaptcha = window.grecaptcha || {};
  window.grecaptcha.enterprise = {
    ready: callback => callback(),
    render: (container, options) => { widget = options; return 0; },
    execute: () => {
      widget.callback(${JSON.stringify(RECAPTCHA_TOKEN)});
      return Promise.resolve(${JSON.stringify(RECAPTCHA_TOKEN)});
    }
  };
})();`;


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
  if (url.host === "www.google.com" && url.pathname === "/recaptcha/enterprise.js") {
    return route.fulfill({ contentType: "text/javascript", body: RECAPTCHA_STUB });
  }
  if (url.host === "content-firebaseappcheck.googleapis.com" && url.pathname.endsWith(":exchangeRecaptchaEnterpriseToken")) {
    diagnostics.appCheckExchanges.push(request.postDataJSON()?.recaptcha_enterprise_token ?? "");
    return route.fulfill({ json: { token: APP_CHECK_TOKEN, ttl: "3600s" } });
  }
  if (url.host === ASK_ASSISTANT_HOST && url.pathname === ASK_ASSISTANT_PATH) {
    const cors = {
      "access-control-allow-origin": APP_ORIGIN,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "*",
      vary: "Origin"
    };
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }
    const data = request.postDataJSON()?.data;
    diagnostics.askAssistant.calls.push({ data, appCheck: request.headers()["x-firebase-appcheck"] ?? "" });
    // A callable replies with { result }, as firebase-functions' onCall does.
    return route.fulfill({ headers: cors, json: { result: await diagnostics.askAssistant.reply(data) } });
  }
  if (url.host === "firestore.googleapis.com") {
    diagnostics.blockedFirestoreRequests.push(`${request.method()} ${url.pathname} ${request.postData() ?? ""}`);
    // Firestore's WebChannel sends its own headers in the form-encoded body's "headers" field.
    const channelHeaders = new URLSearchParams(request.postData() ?? "").get("headers") ?? "";
    diagnostics.firestoreAppCheckTokens.push(/^x-firebase-appcheck:(.*)$/im.exec(channelHeaders)?.[1].trim() ?? "");
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
      blockedFirestoreRequests: [],
      appCheckExchanges: [],
      firestoreAppCheckTokens: [],
      askAssistant: { calls: [], reply: () => ({ kind: "fallback" }) }
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

/**
 * Whether this build has the assistant's AI answers on (assistantHosted.enabled), from the
 * chat's data-ai-answers attribute. Call it with the assistant chat on screen.
 */
export async function hostedAnswersEnabled(page: Page): Promise<boolean> {
  await expect(page.locator("app-assistant-chat .composer, app-assistant-chat app-assistant-composer").first()).toBeVisible();
  return (await page.locator("app-assistant-chat").first().getAttribute("data-ai-answers")) === "on";
}

export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) <= 1024;
}
