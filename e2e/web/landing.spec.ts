// e2e/web/landing.spec.ts
// Landing-page regression coverage for scrolling, navigation, legal access, and responsive behavior.
import { expect, test, type Page } from "@playwright/test";

async function dismissCookieDialog(page: Page) {
  const dialog = page.getByTestId("cookie-consent-dialog");
  const essentialOnly = page.getByTestId("cookie-consent-essential");

  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    await expect(dialog).toHaveCount(0);
    return;
  }

  await essentialOnly.click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });
  await expect(dialog).toHaveCount(0);
}

test.describe("Premium landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).overflowY),
      )
      .not.toBe("hidden");
    await dismissCookieDialog(page);
  });

  test("shows brand logo mark and marketing infographics", async ({ page }) => {
    await expect(page.getByTestId("landing-brand-logo")).toBeVisible();
    await expect(page.getByTestId("brand-logo").first()).toBeVisible();
    await expect(page.getByTestId("landing-hero-infographic")).toBeVisible();
    await expect(page.getByTestId("landing-bento-infographic")).toBeVisible();
    await expect(page.getByTestId("landing-footer-logo")).toBeVisible();
  });

  test("document scrolls to a reachable footer without horizontal overflow", async ({ page }) => {
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
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

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

  test("primary actions and login navigate to authentication", async ({ page }) => {
    await page.getByTestId("landing-header-cta").click();
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
