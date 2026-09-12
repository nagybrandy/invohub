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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("számlázás");
    await expect(page.getByTestId("marketing-hero")).toBeVisible();
    await expect(page.getByText("1 284 500 Ft")).toBeVisible();
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

  test("in-page navigation reaches the product and workflow sections", async ({
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

    await page.getByRole("link", { name: "Munkafolyamat", exact: true }).first().click();
    await expect(page.getByTestId("marketing-section-workflow")).toBeInViewport();
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

  test("switches marketing copy between HU and EN", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    await page.getByTestId("marketing-lang-switcher").getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("invoicing");
    await expect(page.getByTestId("marketing-header-cta")).toHaveText("Start for free");

    await page.getByTestId("marketing-lang-switcher").getByRole("button", { name: "HU" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("számlázás");
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

  test("labels every roadmap item as planned", async ({ page }) => {
    await seedDismissedConsent(page);
    await page.goto("/");

    const roadmap = page.getByTestId("marketing-section-roadmap");
    await roadmap.scrollIntoViewIfNeeded();

    const cards = roadmap.locator(".roadmap__card");
    await expect(cards).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expect(cards.nth(index)).toContainText("Tervezett");
    }
  });

  test("cookie consent denies non-essential storage by default and reopens from the footer", async ({
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
