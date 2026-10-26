import { Page } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import { expect, isMobile, Locale, LOCALES, openResume, test } from "./fixtures";

/* CV assistant journeys: /assistant page, floating panel, citations and fallbacks. */

const readData = (file: string) => JSON.parse(readFileSync(join(__dirname, "..", "src", "assets", "data", file), "utf8"));
const experiences: any[] = readData("experiences.json");
const posts: any[] = readData("posts.json");
const ongoing = experiences.find(e => !e.endAt);
const deevo = experiences.find(e => e.companyName === "Deevo Studio");
const oldestPost = [...posts].sort((a, b) => a.date.slice(6) + a.date.slice(0, 5) < b.date.slice(6) + b.date.slice(0, 5) ? -1 : 1)[0];

const ASSISTANT = {
  en: {
    nav: "AI Assistant",
    title: "AI Assistant",
    pageTitle: "AI Assistant - Guilherme Borges Bastos",
    scope: "Ask about the experience, skills, and posts listed in this CV.",
    disclosure: "Answers use the information published in this CV.",
    launcher: "Ask my AI Assistant",
    close: "Close the AI assistant",
    expand: "Open the AI assistant in a full page",
    composer: "Your question about the CV",
    send: "Send",
    clear: "Clear conversation",
    back: "Back to the resume",
    retry: "Retry",
    fallback: "I can’t answer this question using the information available in my CV. Please contact me directly so I can help.",
    contact: "Contact Guilherme",
    unavailable: "The CV information could not be loaded. Please try again or contact me directly.",
    empty: "Please type a question first.",
    tooLong: "Please shorten your question to 500 characters or fewer.",
    currentRole: "What is your current role?",
    java: "Where have you used Java?",
    posts: "Which posts have you published?",
    salary: "What salary are you looking for?",
    typo: "When did you work at Swiscom?",
    typoOption: "When did you work at Swisscom AG?",
    clarifyTypo: "I couldn’t find that name in my CV exactly. Did you mean one of these questions?",
    before: "And before that?",
    experience: (company: string) => `Experience · ${company}`
  },
  pt: {
    nav: "Assistente de IA",
    title: "Assistente de IA",
    pageTitle: "Assistente de IA - Guilherme Borges Bastos",
    scope: "Pergunte sobre a experiência, as habilidades e os artigos listados neste currículo.",
    disclosure: "As respostas usam as informações publicadas neste currículo.",
    launcher: "Pergunte ao meu Assistente de IA",
    close: "Fechar o assistente de IA",
    expand: "Abrir o assistente de IA em uma página inteira",
    composer: "Sua pergunta sobre o currículo",
    send: "Enviar",
    clear: "Limpar conversa",
    back: "Voltar ao currículo",
    retry: "Tentar novamente",
    fallback: "Não consigo responder a esta pergunta com as informações disponíveis no meu currículo. Entre em contato comigo diretamente para que eu possa ajudar.",
    contact: "Entrar em contato com Guilherme",
    unavailable: "Não foi possível carregar as informações do currículo. Tente novamente ou entre em contato comigo diretamente.",
    empty: "Digite uma pergunta primeiro.",
    tooLong: "Reduza a sua pergunta para no máximo 500 caracteres.",
    currentRole: "Qual é o seu cargo atual?",
    java: "Onde você já usou Java?",
    posts: "Quais artigos você publicou?",
    salary: "Qual é o seu salário?",
    typo: "Quando você trabalhou na Swiscom?",
    typoOption: "Quando você trabalhou na Swisscom AG?",
    clarifyTypo: "Não encontrei exatamente esse nome no meu currículo. Você quis dizer uma destas perguntas?",
    before: "E antes disso?",
    experience: (company: string) => `Experiência · ${company}`
  }
} as const;

const role = (experience: any, locale: Locale) => experience.internationalizations.find((i: any) => i.language === locale).role;
const postTitle = (post: any, locale: Locale) => post.internationalizations.find((i: any) => i.language === locale).title.replace(/<[^>]+>/g, "");

async function openAssistantPage(page: Page, locale: Locale): Promise<void> {
  await page.goto(`/${locale}/assistant`);
  await expect(page.locator("app-assistant-page h1")).toHaveText(ASSISTANT[locale].title);
  await expect(page.locator("app-assistant-chat .suggestions button").first()).toBeVisible();
}

async function askIn(page: Page, scope: string, locale: Locale, question: string): Promise<void> {
  const field = page.locator(scope).getByRole("textbox", { name: ASSISTANT[locale].composer });
  await field.fill(question);
  await field.press("Enter");
  await expect(page.locator(`${scope} .message.visitor .bubble`).last()).toHaveText(new RegExp(question.replace(/[?.*+()]/g, "\\$&")));
}

async function scrollToSection(page: Page, id: string): Promise<void> {
  await page.evaluate(section => document.getElementById(section)!.scrollIntoView({ behavior: "instant" }), id);
}

for (const locale of LOCALES) {
  const text = ASSISTANT[locale];

  test.describe(`${locale} CV assistant`, () => {

    test("the assistant page offers sourced suggestions that all answer", async ({ page }) => {
      await openAssistantPage(page, locale);
      await expect(page).toHaveTitle(text.pageTitle);
      await expect(page.locator("app-assistant-page .scope")).toHaveText(text.scope);
      await expect(page.locator("app-assistant-page .disclosure")).toHaveText(text.disclosure);
      await expect(page.locator("app-assistant-launcher")).toHaveCount(0);
      await expect(page.locator("dialog")).toHaveCount(0);

      // Every suggestion answers (never the fallback).
      const suggestions = await page.locator("app-assistant-chat .starters button").allInnerTexts();
      for (const suggestion of suggestions) {
        await askIn(page, "app-assistant-chat", locale, suggestion);
        await expect(page.locator(".message.assistant").last()).toHaveAttribute("data-answer", "answered");
      }
      await expect(page.locator(".message.assistant")).toHaveCount(suggestions.length);
    });

    test("answers with citations that reveal the cited experience on the resume", async ({ page }) => {
      await openAssistantPage(page, locale);
      await askIn(page, "app-assistant-chat", locale, text.java);
      const answer = page.locator(".message.assistant").last();
      await expect(answer).toHaveAttribute("data-answer", "answered");
      await expect(answer).toContainText(deevo.companyName);
      await expect(answer).not.toContainText("Fácil Tecnologias");

      // Deevo Studio is not the record the carousel shows first.
      await answer.getByRole("link", { name: text.experience(deevo.companyName) }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/\\?experienceId=${deevo.id}#experience$`));
      const selected = page.locator("#experience .events-content li.selected");
      await expect(selected).toHaveAttribute("id", String(deevo.id));
      await expect(selected.locator(".company-name")).toBeFocused();
      await expect(page.locator("section#experience")).toBeInViewport();

      // Back returns to the assistant with the conversation intact (same SPA session).
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/${locale}/assistant$`));
      await expect(page.locator(".message.assistant")).toHaveCount(1);
      await page.goForward();
      await expect(selected).toHaveAttribute("id", String(deevo.id));
    });

    test("About citations reveal the cited education record and topic", async ({ page }) => {
      const about = locale === "en"
        ? { study: "What did you study?", education: "About me · Education", devops: "Summarize your experience in DevOps.", topic: "About me · DevOps" }
        : { study: "O que você estudou?", education: "Sobre mim · Formação", devops: "Resuma sua experiência em DevOps.", topic: "Sobre mim · DevOps" };
      await openAssistantPage(page, locale);
      await askIn(page, "app-assistant-chat", locale, about.study);
      await page.locator(".message.assistant").last().getByRole("link", { name: about.education }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/#education$`));
      const education = page.locator("app-about-details #education");
      await expect(education).toBeInViewport();
      await expect(education).toContainText("UniFACTHUS");

      await page.goto(`/${locale}/assistant`);
      await askIn(page, "app-assistant-chat", locale, about.devops);
      await page.locator(".message.assistant").last().getByRole("link", { name: about.topic }).click();
      const topic = page.locator("app-about-details details#topic-devops");
      await expect(topic).toHaveAttribute("open", "");
      await expect(topic).toBeInViewport();
      await expect(topic).toContainText("Prometheus");
    });

    test("a post citation reveals the post on its carousel page", async ({ page }) => {
      await openAssistantPage(page, locale);
      await askIn(page, "app-assistant-chat", locale, text.posts);
      const title = postTitle(oldestPost, locale);
      await page.locator(".message.assistant").last().getByRole("link", { name: title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/\\?post=.*#posts$`));
      const card = page.locator(`app-posts-carousel li a[href="${oldestPost.http}"]`);
      await expect(card).toBeVisible();
      await expect(card).toBeFocused();
      await expect(page.locator("#posts .paginator .start")).not.toHaveText("1");
    });

    test("unsupported questions get the fallback with a contact action that never sends anything", async ({ page, diagnostics }) => {
      await openAssistantPage(page, locale);
      await askIn(page, "app-assistant-chat", locale, text.salary);
      const answer = page.locator(".message.assistant").last();
      await expect(answer).toHaveAttribute("data-answer", "fallback");
      await expect(answer.locator(".fallback")).toHaveText(text.fallback);
      await expect(answer.locator(".follow-ups button")).not.toHaveCount(0);

      await answer.getByRole("link", { name: text.contact }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/#contact$`));
      await expect(page.locator("section#contact")).toBeInViewport();
      // Nothing is prefilled or submitted.
      await expect(page.locator("#contact textarea[name='message']")).toHaveValue("");
      expect(diagnostics.blockedFirestoreRequests).toEqual([]);
    });

    test("offers a correction for a misspelled name and follows up on the role in context", async ({ page }) => {
      await openAssistantPage(page, locale);
      await askIn(page, "app-assistant-chat", locale, text.typo);
      const clarify = page.locator(".message.assistant").last();
      await expect(clarify).toHaveAttribute("data-answer", "clarify");
      await expect(clarify).toContainText(text.clarifyTypo);
      await expect(clarify.getByRole("link", { name: text.contact })).toBeVisible();

      // Nothing is answered until the visitor picks the corrected question.
      await clarify.getByRole("button", { name: text.typoOption }).click();
      await expect(page.locator(".message.visitor .bubble").last()).toHaveText(text.typoOption);
      await expect(page.locator(".message.assistant").last()).toHaveAttribute("data-answer", "answered");
      await expect(page.locator(".message.assistant").last()).toContainText(ongoing.companyName);

      // "Before that" refers to the role the previous answer was about.
      const previous = [...experiences].filter(e => e.id !== ongoing.id)
        .sort((a, b) => (b.startAt.slice(6) + b.startAt).localeCompare(a.startAt.slice(6) + a.startAt))[0];
      await askIn(page, "app-assistant-chat", locale, text.before);
      const answer = page.locator(".message.assistant").last();
      await expect(answer).toHaveAttribute("data-answer", "answered");
      await expect(answer.getByRole("link", { name: text.experience(previous.companyName) })).toBeVisible();
    });

    test("validates input, sends on Enter and keeps Shift+Enter for new lines", async ({ page }) => {
      await openAssistantPage(page, locale);
      const field = page.getByRole("textbox", { name: text.composer });
      await field.fill("   ");
      await field.press("Enter");
      await expect(page.getByRole("alert")).toHaveText(text.empty);
      await field.fill("x".repeat(501));
      await page.getByRole("button", { name: text.send }).click();
      await expect(page.getByRole("alert")).toHaveText(text.tooLong);
      await expect(page.locator(".message")).toHaveCount(0);

      await field.fill(text.currentRole);
      await field.press("Shift+Enter");
      await expect(field).toHaveValue(`${text.currentRole}\n`);
      await field.press("Enter");
      await expect(page.locator(".message.assistant")).toHaveAttribute("data-answer", "answered");
      await expect(page.locator(".message.assistant")).toContainText(role(ongoing, locale));
      await expect(field).toHaveValue("");

      // Rendered as text: markup typed by the visitor is never interpreted.
      await field.fill("<img src=x onerror=\"window.__xss=1\"><b>bold</b>");
      await field.press("Enter");
      await expect(page.locator(".message.visitor .bubble").last()).toHaveText("<img src=x onerror=\"window.__xss=1\"><b>bold</b>");
      await expect(page.locator(".message.visitor b")).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();

      await page.getByRole("button", { name: text.clear }).click();
      await expect(page.locator(".message")).toHaveCount(0);
      await expect(page.locator("app-assistant-chat .starters button").first()).toBeVisible();
    });

    test("floating panel keeps the conversation and draft, and expands into the page", async ({ page }) => {
      await openResume(page, locale);
      const launcher = page.getByRole("button", { name: text.launcher });
      // Hidden over the welcome section. On phones the About section is already the active one
      // when the page opens.
      if (!isMobile(page)) {
        await expect(launcher).toBeHidden();
      }
      await scrollToSection(page, "about");
      await expect(launcher).toBeVisible();
      const scrollY = await page.evaluate(() => window.scrollY);

      await launcher.click();
      const dialog = page.getByRole("dialog", { name: text.title });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("textbox", { name: text.composer })).toBeFocused();
      await askIn(page, "dialog", locale, text.currentRole);
      await expect(dialog.locator(".message.assistant")).toContainText(role(ongoing, locale));
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

      // Escape closes, restores focus and the exact scroll position.
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(launcher).toBeFocused();
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);

      // Reopening shows the same history; an unsent draft survives expanding to the page.
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".message.assistant")).toHaveCount(1);
      await dialog.getByRole("textbox", { name: text.composer }).fill("Draft that is not sent yet");
      await dialog.getByRole("button", { name: text.expand }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/assistant$`));
      await expect(page.locator("dialog")).toHaveCount(0);
      await expect(page.locator(".message.assistant")).toHaveCount(1);
      const field = page.getByRole("textbox", { name: text.composer });
      await expect(field).toHaveValue("Draft that is not sent yet");
      await expect(field).toBeFocused();

      // Back to the resume and reopen: still the same conversation and draft.
      await page.getByRole("link", { name: text.back }).click();
      await expect(page.locator("app-resume")).toBeVisible();
      await scrollToSection(page, "experience");
      await launcher.click();
      await expect(dialog.locator(".message.assistant")).toHaveCount(1);
      await expect(dialog.getByRole("textbox", { name: text.composer })).toHaveValue("Draft that is not sent yet");

      // A citation from the panel closes it and reveals the record.
      await dialog.getByRole("link", { name: text.experience(ongoing.companyName) }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator("#experience li.selected")).toHaveAttribute("id", String(ongoing.id));
      await expect(page.locator("html")).not.toHaveClass(/assistant-scroll-locked/);
    });

    test("the launcher follows the section in view, also mid-section and when scrolling back up", async ({ page }) => {
      await openResume(page, locale);
      const launcher = page.getByRole("button", { name: text.launcher });
      const scrollTo = (selector: string, offset: number) => page.evaluate(([s, o]) =>
        window.scrollTo({ top: (document.querySelector(s as string) as HTMLElement).offsetTop + (o as number), behavior: "instant" }), [selector, offset]);

      // One jump into the middle of Experience: neither of its edges is near the top of the viewport.
      await scrollTo("app-experience", 300);
      await expect(launcher).toBeVisible();
      await scrollToSection(page, "contact");
      await expect(launcher).toBeHidden();
      // Back up so that Posts fills the top of the viewport and Contact starts below it.
      await page.evaluate(() => {
        const contact = document.querySelector("app-contact")!.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: contact - window.innerHeight * 0.7, behavior: "instant" });
      });
      await expect(launcher).toBeVisible();
    });

    test("header links move between the assistant and the resume without losing the session", async ({ page }) => {
      await openResume(page, locale);
      const nav = page.locator("app-header .nav-container");
      const openMenu = async () => {
        if (isMobile(page) && !(await nav.isVisible())) {
          await page.locator("app-header .navbar-toggle fa-icon").click();
        }
      };
      await openMenu();
      await nav.getByRole("link", { name: text.nav }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/assistant$`));
      await expect(page.locator("app-header a[data-section='assistant']")).toHaveClass(/active/);
      await expect(page.locator("app-header .language-container a").first()).toHaveAttribute("href", "/en/assistant");

      await askIn(page, "app-assistant-chat", locale, text.currentRole);
      await openMenu();
      await nav.locator("a[data-section='about']").click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/#about$`));
      await expect(page.locator("section#about")).toBeInViewport();

      await openMenu();
      await nav.getByRole("link", { name: text.nav }).click();
      await expect(page.locator(".message.assistant")).toHaveCount(1);

      // A reload starts a new session.
      await page.reload();
      await expect(page.locator("app-assistant-chat .starters button").first()).toBeVisible();
      await expect(page.locator(".message")).toHaveCount(0);
    });

    test("shows an availability message with retry when the CV data fails to load", async ({ page, diagnostics }) => {
      let fail = true;
      await page.route("**/assets/data/posts.json", route => fail ? route.fulfill({ status: 500, body: "boom" }) : route.fallback());
      await page.goto(`/${locale}/assistant`);
      const status = page.locator("app-assistant-chat .status.unavailable");
      await expect(status).toContainText(text.unavailable);
      await expect(status.getByRole("link", { name: text.contact })).toBeVisible();
      await expect(page.getByRole("button", { name: text.send })).toBeDisabled();

      fail = false;
      await status.getByRole("button", { name: text.retry }).click();
      await expect(status).toHaveCount(0);
      await askIn(page, "app-assistant-chat", locale, text.currentRole);
      await expect(page.locator(".message.assistant")).toHaveAttribute("data-answer", "answered");

      // The intended failure is the only one: one 500 and DataService's log of it.
      expect(diagnostics.failedFirstPartyRequests).toEqual([expect.stringMatching(/^500 .*\/assets\/data\/posts\.json$/)]);
      expect(diagnostics.consoleErrors.every(e => /server error|500/.test(e))).toBe(true);
      diagnostics.failedFirstPartyRequests.length = 0;
      diagnostics.consoleErrors.length = 0;
    });

    test("questions never leave the browser", async ({ page, diagnostics }) => {
      const marker = "Zebra-Quartz-4711";
      const requests: string[] = [];
      page.on("request", request => requests.push(`${request.url()} ${request.postData() ?? ""}`));
      const consoleText: string[] = [];
      page.on("console", message => consoleText.push(message.text()));

      await openResume(page, locale);
      await scrollToSection(page, "posts");
      await page.getByRole("button", { name: text.launcher }).click();
      await expect(page.locator("dialog .suggestions button").first()).toBeVisible();
      const before = requests.length;
      const externalBefore = diagnostics.externalRequests.length;

      await askIn(page, "dialog", locale, `${text.currentRole} ${marker}`);
      await askIn(page, "dialog", locale, text.java);
      await page.locator("dialog").getByRole("textbox", { name: text.composer }).fill(`draft ${marker}`);
      await page.waitForTimeout(500);

      // Answering made no request at all (the data was already loaded), first- or third-party.
      expect(requests.slice(before)).toEqual([]);
      expect(diagnostics.externalRequests.length).toBe(externalBefore);
      expect(requests.some(r => r.includes(marker))).toBe(false);
      expect(consoleText.some(t => t.includes(marker))).toBe(false);
      expect(page.url()).not.toContain(marker);
      expect(await page.evaluate(m => JSON.stringify((window as any).dataLayer ?? []).includes(m), marker)).toBe(false);
    });
  });
}

test("the AI Assistant nav link is highlighted once, on the first visit only", async ({ page }) => {
  test.skip(isMobile(page), "the nav is collapsed behind the menu button on phones");
  await openResume(page, "en");
  const link = page.locator('app-header a[data-section="assistant"]');
  await expect(link).toHaveClass(/assistant-intro/, { timeout: 5000 });
  await expect(link).not.toHaveClass(/assistant-intro/, { timeout: 5000 });

  await page.reload();
  await expect(page.locator("app-header")).toBeVisible();
  // Past the start delay: a returning visitor never gets the highlight again.
  await page.waitForTimeout(2000);
  await expect(link).not.toHaveClass(/assistant-intro/);
});

test("the AI Assistant nav link always shows a New badge", async ({ page }) => {
  await openResume(page, "en");
  if (isMobile(page)) {
    await page.locator("app-header .navbar-toggle fa-icon").click();
  }
  const badge = page.locator('app-header a[data-section="assistant"] .new-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/new/i);
  // The badge is decorative: the link keeps its plain accessible name.
  await expect(page.locator('app-header a[data-section="assistant"]')).toHaveAccessibleName("AI Assistant");

  // It stays after the visitor has used the assistant.
  await page.goto("/en/assistant");
  await expect(page.locator("app-assistant-page h1")).toBeVisible();
  await expect(badge).toHaveCount(1);
});

test("the 404 page has no assistant launcher", async ({ page }) => {
  await page.goto("/en/nothing-here");
  await expect(page.locator("app-page-not-found .page-not-found-text")).toBeVisible();
  await expect(page.locator("app-assistant-launcher")).toHaveCount(0);
});

test("long answers wrap without horizontal scrolling at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openAssistantPage(page, "en");
  await askIn(page, "app-assistant-chat", "en", "Which technologies are listed in your CV?");
  await askIn(page, "app-assistant-chat", "en", "Tell me about your work at Swisscom.");
  await askIn(page, "app-assistant-chat", "en", "What are your social media profiles?");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
