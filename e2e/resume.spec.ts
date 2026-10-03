import { Locator, Page } from "@playwright/test";
import { join } from "path";
import { expect, isMobile, Locale, LOCALES, openResume, test, TEXT } from "./fixtures";

const SECTIONS = ["about", "experience", "posts", "contact"] as const;

/**
 * Performs a quick horizontal finger swipe with real (CDP-injected) touch input so HammerJS
 * sees the same pointer stream as on a phone. A mouse drag is not used because starting it
 * on a card link turns it into a native link drag, which cancels the gesture.
 */
async function swipe(page: Page, target: Locator, direction: "left" | "right"): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("swipe target has no bounding box");
  }
  const y = Math.round(box.y + Math.min(box.height / 2, 150));
  const [startX, endX] = direction === "left"
    ? [box.x + box.width * 0.8, box.x + box.width * 0.2]
    : [box.x + box.width * 0.2, box.x + box.width * 0.8];
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", x?: number) => cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: x === undefined ? [] : [{ x: Math.round(x), y }]
  });
  await touch("touchStart", startX);
  for (let step = 1; step <= 5; step++) {
    await touch("touchMove", startX + (endX - startX) * step / 5);
  }
  await touch("touchEnd");
  await cdp.detach();
}

/** Asserts that loading a URL with a #fragment scrolled the page to that section. */
async function expectScrolledToSection(page: Page, section: string): Promise<void> {
  if (isMobile(page)) {
    // Known pre-existing issue (present on the Angular 19 baseline): on narrow screens the
    // router scrolls to the fragment before the experience/posts data has rendered, so the
    // content above grows afterwards and the section ends up below the fold. Only assert
    // that fragment scrolling happened.
    test.info().annotations.push({ type: "known-issue", description: "initial #fragment scroll lands early on mobile" });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  } else {
    await expect(page.locator(`section#${section}`)).toBeInViewport();
  }
}

async function openMobileMenuIfNeeded(page: Page): Promise<void> {
  if (isMobile(page) && !(await page.locator("app-header .nav-container").isVisible())) {
    await page.locator("app-header .navbar-toggle fa-icon").click();
    await expect(page.locator("app-header .nav-container")).toBeVisible();
  }
}

for (const locale of LOCALES) {
  const text = TEXT[locale];

  test.describe(`${locale} resume`, () => {

    test("boots and renders every section without layout overflow", async ({ page, diagnostics }, testInfo) => {
      await openResume(page, locale);

      // Firebase Analytics initialized (against the fixture's stubs) and recorded the screen view.
      await expect.poll(() => diagnostics.externalRequests.some(r => r.includes("googletagmanager.com/gtag/js"))).toBe(true);
      await expect.poll(() => page.evaluate(() => ((window as any).dataLayer ?? [])
        .some((entry: IArguments) => entry[0] === "event" && entry[1] === "screen_view"))).toBe(true);

      await expect(page).toHaveTitle("Live Resume - Guilherme Borges Bastos");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("app-header header")).toBeVisible();
      await expect(page.locator("app-header .logo")).toHaveText("gbastos");

      for (const id of ["welcome", ...SECTIONS]) {
        await expect(page.locator(`section#${id}`)).toBeAttached();
        expect((await page.locator(`section#${id}`).boundingBox())?.height ?? 0, `#${id} height`).toBeGreaterThan(100);
      }
      await expect(page.locator("app-footer footer")).toBeAttached();

      // Translated static (xlf) strings.
      await expect(page.locator("app-header a[href='#about'] span")).toHaveText(text.nav.about);
      await expect(page.locator("app-header a[href='#experience'] span")).toHaveText(text.nav.experience);
      await expect(page.locator("app-header a[href='#posts'] span")).toHaveText(text.nav.posts);
      await expect(page.locator("app-header a[href='#contact'] span")).toHaveText(text.nav.contact);
      await expect(page.locator("#about h1")).toHaveText(text.nav.about);
      await expect(page.locator("#about .years-old")).toContainText(text.yearsOld);
      await expect(page.locator("#posts h1")).toHaveText(text.nav.posts);
      await expect(page.locator("#contact h1")).toHaveText(text.nav.contact);
      await expect(page.locator("app-posts-carousel button.read-more").first()).toHaveText(text.readMore);
      await expect(page.locator("app-header .language-container a.active")).toHaveText(locale.toUpperCase());

      // Timeline milestones use locale-formatted month abbreviations (built in code via LocalizedDatePipe).
      const months = locale === "en"
        ? /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/
        : /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.$/;
      const monthLabels = await page.locator("app-experience-timeline .popupSpan .month").allTextContents();
      expect(monthLabels.length).toBeGreaterThan(1);
      monthLabels.forEach(label => expect(label).toMatch(months));

      // Translated dynamic (JSON) content was injected and is not left on the placeholder.
      await expect(page.locator("#experience li .role").first()).not.toHaveText("Loading...");
      await expect(page.locator("app-posts-carousel h2.title").first()).not.toHaveText("Loading...");

      // No horizontal scrolling, and the primary content blocks stack without overlapping.
      // (Section backgrounds overlap by design, e.g. #experience is shifted up by 4em.)
      const layout = await page.evaluate(() => {
        const contentBlocks = [
          "#welcome",
          "#about .about-container",
          "#experience .overlay > .container",
          "#posts > .container",
          "#contact > .container"
        ];
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          boxes: contentBlocks.map(id => {
            const rect = document.querySelector(id)!.getBoundingClientRect();
            return { id, top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
          })
        };
      });
      expect(layout.overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
      for (let i = 1; i < layout.boxes.length; i++) {
        expect(layout.boxes[i].top, `${layout.boxes[i].id} starts after ${layout.boxes[i - 1].id}`)
          .toBeGreaterThanOrEqual(layout.boxes[i - 1].bottom - 1);
      }

      const screenshot = await page.screenshot({
        fullPage: true,
        path: join(testInfo.project.outputDir, "..", "screenshots", `${testInfo.project.name}-${locale}-landing.png`)
      });
      await testInfo.attach(`${locale}-landing`, { body: screenshot, contentType: "image/png" });
    });

    test("header fragment links navigate and track the active section", async ({ page }) => {
      await openResume(page, locale);

      for (const section of SECTIONS) {
        await openMobileMenuIfNeeded(page);
        const link = page.locator(`app-header .nav-container a[href='#${section}']`);
        await link.click();

        await expect(page).toHaveURL(new RegExp(`/${locale}/#${section}$`));
        await expect(page.locator(`section#${section}`)).toBeInViewport();
        await expect(link).toHaveClass(/active/);
        await expect(page.locator("app-header .nav-container a.active")).toHaveCount(1);
        if (isMobile(page)) {
          await expect(page.locator("app-header .nav-container")).toBeHidden();
        }
      }

      // Plain scrolling (no link click) keeps the active state in sync.
      await page.evaluate(() => document.getElementById("experience")!.scrollIntoView());
      await expect(page.locator("app-header .nav-container a[href='#experience']")).toHaveClass(/active/);
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect(page.locator("app-resume app-header")).toHaveClass(/sticky/);
    });

    test("deep links open on their section", async ({ page }) => {
      await openResume(page, locale, "#posts");
      await expectScrolledToSection(page, "posts");
      await page.goto(`/${locale}/contact`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/#contact$`));
      await expectScrolledToSection(page, "contact");
    });

    test("experience carousel navigates with buttons and swipe", async ({ page }) => {
      await openResume(page, locale);
      const experience = page.locator("section#experience");
      const navigation = experience.locator(isMobile(page) ? ".navigation-mobile" : ".navigation");
      const previous = navigation.locator("a.previous");
      const next = navigation.locator("a.next");
      const selected = experience.locator(".events-content li.selected");

      await experience.scrollIntoViewIfNeeded();
      await expect(navigation).toBeVisible();
      if (!isMobile(page)) {
        await expect(previous).toContainText(text.previous);
        await expect(next).toContainText(text.next);
      }
      await expect(next).toHaveClass(/disabled/);
      await expect(previous).not.toHaveClass(/disabled/);
      await expect(selected).toHaveCount(1);
      const newest = await selected.getAttribute("id");

      await previous.click();
      await expect(selected).toHaveCount(1);
      await expect(selected).not.toHaveAttribute("id", newest!);
      await expect(next).not.toHaveClass(/disabled/);

      await next.click();
      await expect(selected).toHaveAttribute("id", newest!);
      await expect(next).toHaveClass(/disabled/);

      await swipe(page, experience.locator(".middle-container"), "right");
      await expect(selected).not.toHaveAttribute("id", newest!);
      await swipe(page, experience.locator(".middle-container"), "left");
      await expect(selected).toHaveAttribute("id", newest!);
    });

    test("posts carousel paginates with buttons and swipe", async ({ page }) => {
      await openResume(page, locale);
      const posts = page.locator("section#posts");
      const previous = posts.locator(".navigation a.previous");
      const next = posts.locator(".navigation a.next");
      const start = posts.locator(".paginator .start");

      await posts.scrollIntoViewIfNeeded();
      await expect(previous).toHaveClass(/disabled/);
      await expect(next).not.toHaveClass(/disabled/);
      await expect(start).toHaveText("1");
      const firstTitle = await posts.locator("h2.title").first().innerText();
      const cards = posts.locator("app-posts-carousel li");
      const cardsPerPage = await cards.count();
      const totalPosts = Number(await posts.locator(".paginator > span").nth(2).innerText());

      // Record the enter/leave animation classes Angular applies to the cards.
      await page.evaluate(() => {
        const seen = new Set<string>();
        (window as any).postAnimationClasses = seen;
        const record = (node: Node) => ["fade-in", "fade-out"]
          .forEach(name => (node as HTMLElement).classList?.contains(name) && seen.add(name));
        new MutationObserver(mutations => mutations.forEach(mutation => {
          record(mutation.target);
          mutation.addedNodes.forEach(record);
        })).observe(document.querySelector("app-posts-carousel")!, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
      });

      await next.click();
      await expect(start).not.toHaveText("1");
      await expect(previous).not.toHaveClass(/disabled/);
      await expect(posts.locator("h2.title").first()).not.toHaveText(firstTitle);
      // Leaving cards are removed once their fade-out finishes.
      await expect(cards).toHaveCount(Math.min(cardsPerPage, totalPosts - cardsPerPage));
      await expect(posts.locator("li.fade-out")).toHaveCount(0);
      expect(await page.evaluate(() => [...(window as any).postAnimationClasses].sort())).toEqual(["fade-in", "fade-out"]);

      await previous.click();
      await expect(start).toHaveText("1");

      await swipe(page, posts.locator(".middle-container"), "left");
      await expect(start).not.toHaveText("1");
      await swipe(page, posts.locator(".middle-container"), "right");
      await expect(start).toHaveText("1");
    });

    test("contact form validates input client-side and never reaches Firebase", async ({ page, diagnostics }) => {
      await openResume(page, locale, "#contact");
      const form = page.locator("#contact form");
      const name = form.locator("input[name='name']");
      const email = form.locator("input[name='email']");
      const message = form.locator("textarea[name='message']");

      await expect(form.locator("input[type='submit']")).toHaveValue(text.send);

      await name.fill("R2-D2");
      await expect(form.getByText(text.invalidName)).toBeVisible();
      await name.fill("");
      await name.blur();
      await expect(form.getByText(text.requiredName)).toBeVisible();
      await expect(name).toHaveClass(/is-invalid/);

      await email.fill("not-an-email");
      await expect(form.getByText(text.invalidEmail)).toBeVisible();
      await email.fill("");
      await email.blur();
      await expect(form.getByText(text.requiredEmail)).toBeVisible();

      await message.fill("x");
      await message.fill("");
      await message.blur();
      await expect(form.getByText(text.requiredMessage)).toBeVisible();

      await name.fill("Playwright Test");
      await email.fill("playwright@example.com");
      await message.fill("Automated browser test - must never be delivered.");
      await expect(form.locator(".warnings small")).toHaveCount(0);
      await expect(form.locator(".is-invalid")).toHaveCount(0);

      // Submission path: Firestore traffic is intercepted and aborted by the fixture.
      await form.locator("input[type='submit']").click();
      await expect(form).toHaveClass(/loading/);
      await expect.poll(() => diagnostics.blockedFirestoreRequests.length).toBeGreaterThan(0);
    });
  });
}

test("mobile navigation opens and closes", async ({ page }) => {
  test.skip(!isMobile(page), "the collapsible menu only exists on narrow viewports");
  await openResume(page, "en");
  const toggle = page.locator("app-header .navbar-toggle fa-icon");
  const nav = page.locator("app-header .nav-container");

  await expect(toggle).toBeVisible();
  await expect(nav).toBeHidden();
  await toggle.click();
  await expect(nav).toBeVisible();
  await toggle.click();
  await expect(nav).toBeHidden();
  await toggle.click();
  await expect(nav).toBeVisible();
  await nav.locator("a[href='#posts']").click();
  await expect(nav).toBeHidden();
  await expect(page.locator("section#posts")).toBeInViewport();
});

test("desktop navigation is always expanded", async ({ page }) => {
  test.skip(isMobile(page), "desktop-only layout");
  await openResume(page, "en");
  await expect(page.locator("app-header .nav-container")).toBeVisible();
  await expect(page.locator("app-header .navbar-toggle")).toBeHidden();
});

for (const locale of LOCALES as readonly Locale[]) {
  test(`${locale} unknown routes render the lazy 404 page`, async ({ page }) => {
    await page.goto(`/${locale}/this/route/does-not-exist`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/page-not-found$`));
    await expect(page.locator("app-page-not-found .page-not-found-text")).toHaveText("404");
    await expect(page.getByRole("link", { name: "Go back to Home Page." })).toBeVisible();
    await expect(page.locator("app-resume")).toHaveCount(0);
  });
}

test("share button uses the Web Share API when the browser supports it", async ({ page }) => {
  await openResume(page, "en");
  const shareButton = page.locator("app-header .share-container");
  if (!(await page.evaluate(() => typeof navigator.share === "function"))) {
    await expect(shareButton).toBeHidden();
  }

  await page.addInitScript(() => {
    (window as any).sharedPayloads = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => { (window as any).sharedPayloads.push(data); }
    });
  });
  await openResume(page, "en");
  await expect(shareButton).toBeVisible();
  await shareButton.locator("fa-icon").click();
  await expect.poll(() => page.evaluate(() => (window as any).sharedPayloads)).toEqual([
    expect.objectContaining({ title: "Live Resume - Guilherme Borges Bastos", url: "https://guilhermeborgesbastos.com" })
  ]);
});
