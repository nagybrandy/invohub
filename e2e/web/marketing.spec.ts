// e2e/web/marketing.spec.ts
// Coverage for the static marketing homepage: layout, navigation, consent, and responsiveness.
import { expect, test, type Page } from "@playwright/test";

const CONSENT_STORAGE_KEY = "invohub.cookie-consent.v1";

async function seedDismissedConsent(page: Page) {
  await page.addInitScript(
    ({ storageKey }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          essential: true,
          analytics: false,
          marketing: false,
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    { storageKey: CONSENT_STORAGE_KEY },
  );
}

function isMobile(projectName: string) {
  return projectName.includes("mobile");
}

test.describe("Static marketing homepage", () => {
  test("renders the brand, hero, and product surface", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    await expect(page.getByTestId("marketing-page")).toBeVisible();
    await expect(page.getByTestId("marketing-brand")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("bevallásig");
    await expect(page.getByTestId("marketing-hero")).toBeVisible();
    await expect(page.getByText("1 284 500 Ft")).toBeVisible();
  });

  test("shows the primary CTA above the fold on a small phone viewport", async ({
    page,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Mobile-specific viewport check");
    await page.setViewportSize({ width: 375, height: 812 });
    await seedDismissedConsent(page);
    await page.goto("/");

    const primaryCta = page.getByTestId("marketing-hero").locator(".btn--primary");
    await expect(primaryCta).toBeVisible();
    const box = await primaryCta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThan(812);
  });

  test("scrolls to a reachable footer without horizontal overflow", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.viewportHeight * 2);

    const footer = page.getByTestId("marketing-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("keeps marketing sections visible after a jump scroll", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await expect(page.getByTestId("marketing-footer")).toBeVisible();

    const hidden = await page.evaluate(() =>
      Array.prototype.filter.call(
        document.querySelectorAll("[data-reveal]"),
        (node) => window.getComputedStyle(node).opacity === "0",
      ).length,
    );

    expect(hidden).toBe(0);
  });

  test("in-page navigation reaches the product and roadmap sections", async ({
    page,
  }, testInfo) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    await page.getByTestId("marketing-product-tour").click();
    await expect(page.getByTestId("marketing-section-product")).toBeInViewport();

    if (isMobile(testInfo.project.name)) {
      await page.getByTestId("marketing-menu-toggle").click();
      await expect(page.getByTestId("marketing-mobile-menu")).toBeVisible();
    }

    await page.getByRole("link", { name: "EV-út", exact: true }).first().click();
    await expect(page.getByTestId("marketing-section-roadmap")).toBeInViewport();
  });

  test("uses a floating transparent header that solidifies on scroll", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    const header = page.getByTestId("marketing-header");
    await expect(header).toBeVisible();
    await expect(header).not.toHaveClass(/is-solid/);

    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveClass(/is-solid/);
  });

  test("switches marketing copy between HU and EN", async ({ page }, testInfo) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    // On mobile the switch lives inside the fullscreen menu, not the top bar.
    if (isMobile(testInfo.project.name)) {
      await page.getByTestId("marketing-menu-toggle").click();
    }
    const switcher = isMobile(testInfo.project.name)
      ? page.getByTestId("marketing-mobile-lang-switcher")
      : page.getByTestId("marketing-lang-switcher");

    await switcher.getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("tax return");

    if (isMobile(testInfo.project.name)) {
      // The header CTA isn't in the top bar on mobile — check the menu's CTA.
      await expect(page.getByTestId("marketing-mobile-menu")).toContainText("Start for free");
      await switcher.getByRole("button", { name: "HU" }).click();
    } else {
      await expect(page.getByTestId("marketing-header-cta")).toHaveText("Start for free");
      await switcher.getByRole("button", { name: "HU" }).click();
    }
    await expect(page.getByRole("heading", { level: 1 })).toContainText("bevallásig");
  });

  test("primary calls to action point at the application login", async ({ page }, testInfo) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    if (!isMobile(testInfo.project.name)) {
      await expect(page.getByTestId("marketing-header-cta")).toHaveAttribute("href", "/login");
    }

    await expect(
      page.getByRole("link", { name: "Belépés az alkalmazásba" }),
    ).toHaveAttribute("href", "/login");
  });

  test("labels the EV journey with distinct, honest statuses", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    const roadmap = page.getByTestId("marketing-section-roadmap");
    await roadmap.scrollIntoViewIfNeeded();

    const cards = roadmap.locator(".journey__card");
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toContainText("Elérhető");
    await expect(cards.nth(0)).toContainText("Számlázás");
    await expect(cards.nth(1)).toContainText("Fejlesztés alatt");
    await expect(cards.nth(1)).toContainText("Banki párosítás");
    await expect(cards.nth(2)).toContainText("Tervezett");
    await expect(cards.nth(3)).toContainText("Tervezett");

    // No start date is ever promised for the non-shipped stages.
    await expect(roadmap).not.toContainText(/202[5-9]\s*(Q[1-4])?/i);
  });

  test("keeps the language switcher as the right-most header control on desktop, and inside the fullscreen menu (not the top bar) on mobile", async ({
    page,
  }, testInfo) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    if (isMobile(testInfo.project.name)) {
      // Top bar stays down to just brand + hamburger — no CTA, no language
      // switch cluttering it.
      await expect(page.getByTestId("marketing-lang-switcher")).toBeHidden();

      const toggle = page.getByTestId("marketing-menu-toggle");
      const toggleBox = await toggle.boundingBox();
      expect(toggleBox).not.toBeNull();
      const brand = page.getByTestId("marketing-brand");
      const brandBox = await brand.boundingBox();
      expect(brandBox).not.toBeNull();
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      // Right-aligned, not centered between brand and the edge.
      expect(toggleBox!.x + toggleBox!.width).toBeGreaterThan(viewport!.width * 0.75);

      await toggle.click();
      await expect(page.getByTestId("marketing-mobile-lang-switcher")).toBeVisible();
    } else {
      const switcher = page.getByTestId("marketing-lang-switcher");
      const switcherBox = await switcher.boundingBox();
      expect(switcherBox).not.toBeNull();

      const cta = page.getByTestId("marketing-header-cta");
      const ctaBox = await cta.boundingBox();
      expect(ctaBox).not.toBeNull();

      const login = page.getByRole("link", { name: "Belépés", exact: true }).first();
      const loginBox = await login.boundingBox();
      expect(loginBox).not.toBeNull();

      // Order on desktop: nav | login + CTA | language switch (far right).
      expect(switcherBox!.x).toBeGreaterThan(loginBox!.x);
      expect(switcherBox!.x).toBeGreaterThan(ctaBox!.x);
      expect(switcherBox!.x + switcherBox!.width).toBeGreaterThan(ctaBox!.x + ctaBox!.width);
    }
  });

  test("cookie bar stays compact on mobile and never covers the hero CTA", async ({
    page,
  }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Mobile-specific viewport check");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const dialog = page.getByTestId("cookie-consent-dialog");
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(160);

    const cta = page.getByTestId("marketing-product-tour");
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    // The bar must not overlap the hero's secondary CTA.
    expect(ctaBox!.y + ctaBox!.height).toBeLessThan(box!.y);
  });

  test("cookie consent denies non-essential storage on the first click and reopens from the footer", async ({
    page,
  }) => {
    await page.goto("/");

    const dialog = page.getByTestId("cookie-consent-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("cookie-consent-essential").click();
    await expect(dialog).toBeHidden();

    const stored = await page.evaluate(
      (storageKey) => JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
      CONSENT_STORAGE_KEY,
    );
    expect(stored).toMatchObject({ essential: true, analytics: false, marketing: false });

    await page.getByTestId("marketing-footer").scrollIntoViewIfNeeded();
    await page.getByTestId("footer-cookie-preferences").click();
    await expect(dialog).toBeVisible();
  });

  test("cookie settings expand in place and save a custom selection", async ({ page }) => {
    await page.goto("/");

    const dialog = page.getByTestId("cookie-consent-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("cookie-consent-settings").click();
    const analytics = page.locator('[data-consent="analytics"]');
    await expect(analytics).toBeVisible();
    await analytics.check();

    await page.getByTestId("cookie-consent-save").click();
    await expect(dialog).toBeHidden();

    const stored = await page.evaluate(
      (storageKey) => JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
      CONSENT_STORAGE_KEY,
    );
    expect(stored).toMatchObject({ essential: true, analytics: true, marketing: false });
  });

  test("footer no longer carries the legal-drafts disclaimer", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    const footer = page.getByTestId("marketing-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).not.toContainText("tervezetek");
  });

  test("reveals a pricing section and an FAQ with expandable answers", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    const pricing = page.getByTestId("marketing-section-pricing");
    await pricing.scrollIntoViewIfNeeded();
    await expect(pricing).toContainText("ingyenes");

    const faq = page.getByTestId("marketing-section-faq");
    await faq.scrollIntoViewIfNeeded();
    const firstQuestion = faq.locator("summary").first();
    await expect(firstQuestion).toBeVisible();
    await firstQuestion.click();
    await expect(faq.locator("details").first()).toHaveJSProperty("open", true);
  });

  test("keeps mobile navigation usable with large tap targets", async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo.project.name), "Mobile-specific navigation");

    await seedDismissedConsent(page);
    await page.goto("/");

    const toggle = page.getByTestId("marketing-menu-toggle");
    expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    const menu = page.getByTestId("marketing-mobile-menu");
    await expect(menu).toBeVisible();

    const links = menu.getByRole("link");
    const count = await links.count();
    expect(count).toBeGreaterThan(3);
    for (let index = 0; index < count; index += 1) {
      expect((await links.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
