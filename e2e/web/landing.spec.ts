// e2e/web/landing.spec.ts
// Landing-page regression coverage for scrolling, navigation, legal access, and responsive behavior.
import { expect, test, type Page } from "@playwright/test";

const COOKIE_CONSENT_STORAGE_KEY = "invohub.cookie-consent.v1";

async function seedDismissedCookieConsent(page: Page) {
  await page.addInitScript(
    ({ storageKey }) => {
      const consent = JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
        updatedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(storageKey, consent);
    },
    { storageKey: COOKIE_CONSENT_STORAGE_KEY },
  );
}

async function dismissCookieDialog(page: Page) {
  const dialog = page.getByTestId("cookie-consent-dialog");
  const essentialOnly = page.getByTestId("cookie-consent-essential");

  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    await expect(dialog).toHaveCount(0);
    return;
  }

  await essentialOnly.click({ force: true });
  await expect(dialog).toHaveCount(0, { timeout: 5_000 });
}

test.describe("Premium landing page", () => {
  test.beforeEach(async ({ page }) => {
    await seedDismissedCookieConsent(page);
    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).overflowY),
      )
      .not.toBe("hidden");
    await dismissCookieDialog(page);
  });

  test("shows brand logo mark, hero, product showcase and footer", async ({ page }) => {
    await expect(page.getByTestId("landing-brand-logo")).toBeVisible();
    await expect(page.getByTestId("brand-logo").first()).toBeVisible();
    await expect(page.getByTestId("landing-hero-brand")).toBeVisible();
    // The stock-style "infographic" images were removed on purpose (owner
    // feedback, 2026-09-14); the hero's real product visual is ProductShowcase.
    await expect(page.getByTestId("landing-hero-infographic")).toHaveCount(0);
    await expect(page.getByTestId("landing-bento-infographic")).toHaveCount(0);
    await expect(page.getByTestId("landing-footer-logo")).toBeVisible();
    await expect(page.getByTestId("landing-section-insights")).toBeVisible();
  });

  test("document scrolls to a reachable footer without horizontal overflow", async ({ page }) => {
    await expect
      .poll(async () =>
        page.evaluate(() =>
          Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight,
            document.getElementById("root")?.scrollHeight ?? 0,
          ),
        ),
      )
      .toBeGreaterThan(await page.evaluate(() => window.innerHeight * 2));

    const dimensions = await page.evaluate(() => ({
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      rootOverflowY: getComputedStyle(document.documentElement).overflowY,
      scrollHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.getElementById("root")?.scrollHeight ?? 0,
      ),
      viewportHeight: window.innerHeight,
      scrollWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
        document.getElementById("root")?.scrollWidth ?? 0,
      ),
      viewportWidth: window.innerWidth,
    }));

    expect(["visible", "auto", "clip"]).toContain(dimensions.bodyOverflowY);
    expect(dimensions.bodyOverflowY).not.toBe("hidden");
    expect(["visible", "auto", "clip"]).toContain(dimensions.rootOverflowY);
    expect(dimensions.rootOverflowY).not.toBe("hidden");
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.viewportHeight * 2);
    // Prefer content that fits the viewport; allow only a tiny subpixel/scrollbar delta.
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

    const horizontalScrollLeft = await page.evaluate(() => {
      const before = window.scrollX;
      window.scrollTo(2_000, window.scrollY);
      const after = window.scrollX;
      window.scrollTo(before, window.scrollY);
      return after;
    });
    expect(horizontalScrollLeft).toBe(0);

    const footer = page.getByTestId("landing-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
    expect(
      await page.evaluate(() =>
        Math.max(
          window.scrollY,
          document.documentElement.scrollTop,
          document.body.scrollTop,
          document.getElementById("root")?.scrollTop ?? 0,
        ),
      ),
    ).toBeGreaterThan(0);
  });

  test("product tour and compact navigation reach their sections", async ({ page }, testInfo) => {
    await page.getByTestId("landing-product-tour").click();
    await expect(page.getByTestId("landing-section-product")).toBeInViewport();

    if (testInfo.project.name.includes("mobile")) {
      await page.getByTestId("landing-menu-toggle").click();
    }
    await page.getByRole("link", { name: /^(Munkafolyamat|Workflow)$/i }).click();
    await expect(page.getByTestId("landing-section-workflow")).toBeInViewport();
  });

  test("primary actions and login navigate to authentication", async ({ page }, testInfo) => {
    if (testInfo.project.name.includes("mobile")) {
      // On mobile the top bar is just brand + hamburger; the CTA lives in the
      // fullscreen menu.
      await page.getByTestId("landing-menu-toggle").click();
      await page.getByTestId("landing-mobile-cta").click();
    } else {
      await page.getByTestId("landing-header-cta").click();
    }
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await dismissCookieDialog(page);
    await page.getByTestId("landing-footer").scrollIntoViewIfNeeded();
    await page
      .getByRole("link", { name: /^(Belépés az alkalmazásba|Log in to the app)$/i })
      .click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("footer reopens cookie preferences and legal links remain reachable", async ({ page }) => {
    const footer = page.getByTestId("landing-footer");
    await footer.scrollIntoViewIfNeeded();
    await page.getByTestId("footer-cookie-preferences").click();
    await expect(page.getByTestId("cookie-consent-dialog")).toBeVisible();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.getByTestId("cookie-consent-essential").click();
    await expect(page.getByTestId("cookie-consent-dialog")).toHaveCount(0);
    await page.getByRole("link", { name: /^(Adatkezelés|Privacy)$/i }).click();
    await expect(page).toHaveURL(/\/adatkezeles$/);
    await expect(page.locator("body")).toContainText(/Adatkezel|Privacy/i);
  });

  test("mobile menu exposes navigation and keeps touch targets usable", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Mobile-specific navigation");

    await page.getByTestId("landing-menu-toggle").click();
    await expect(page.getByTestId("landing-mobile-menu")).toBeVisible();

    const roadmapLink = page.getByRole("link", { name: /^(Irány|Direction)$/i });
    expect((await roadmapLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await roadmapLink.click();
    await expect(page.getByTestId("landing-section-roadmap")).toBeInViewport();
  });
});
