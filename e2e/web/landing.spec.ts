// e2e/web/landing.spec.ts
// Landing-page regression coverage for scrolling, navigation, legal access, and responsive behavior.
import { expect, test, type Page } from "@playwright/test";

async function dismissCookieDialog(page: Page) {
  const essentialOnly = page.getByRole("button", {
    name: /^(Csak szükséges|Essential only)$/i,
  });
  const dialogAppeared = await essentialOnly
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (dialogAppeared) {
    await essentialOnly.click();
    await expect(page.getByRole("alert")).toBeHidden();
  }
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

    expect(dimensions.bodyOverflowY).not.toBe("hidden");
    expect(dimensions.rootOverflowY).not.toBe("hidden");
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.viewportHeight * 2);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

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
    await page.getByRole("link", { name: /^(Belépés az alkalmazásba|Log in to the app)$/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("footer reopens cookie preferences and legal links remain reachable", async ({ page }) => {
    const footer = page.getByTestId("landing-footer");
    await footer.scrollIntoViewIfNeeded();
    await page.getByTestId("footer-cookie-preferences").click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.getByRole("button", {
      name: /^(Csak szükséges|Essential only)$/i,
    }).click();
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
