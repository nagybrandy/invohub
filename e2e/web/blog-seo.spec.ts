// e2e/web/blog-seo.spec.ts
// Blog routes, landing↔blog links, and technical SEO meta coverage.
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
    return;
  }
  await essentialOnly.click({ force: true });
  await expect(dialog).toHaveCount(0, { timeout: 5_000 });
}

test.describe("Blog and technical SEO", () => {
  test.beforeEach(async ({ page }) => {
    await seedDismissedCookieConsent(page);
  });

  test("blog index lists articles and opens a post", async ({ page }) => {
    await page.goto("/blog");
    await dismissCookieDialog(page);
    await expect(page.getByTestId("blog-index-page")).toBeVisible();
    await expect(page.getByTestId("blog-card-magyar-szamlazas-alapok")).toBeVisible();
    await page.getByTestId("blog-card-magyar-szamlazas-alapok").click();
    await expect(page).toHaveURL(/\/blog\/magyar-szamlazas-alapok$/);
    await expect(page.getByTestId("blog-article-page")).toBeVisible();
    await expect(page.getByTestId("blog-article-title")).toContainText(/számlázás/i);
  });

  test("article page exposes title, description, canonical, and JSON-LD", async ({
    page,
  }) => {
    await page.goto("/blog/pdf-es-email-szamlakuldes");
    await dismissCookieDialog(page);

    await expect(page).toHaveTitle(/PDF|e-mail|InvoHub/i);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /.+/);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/blog\/pdf-es-email-szamlakuldes$/);
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /.+/);

    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd.first()).toBeAttached();
    const payloads = await jsonLd.allTextContents();
    expect(payloads.join(" ")).toMatch(/BlogPosting|Organization/);
  });

  test("landing links to blog and blog links back home", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await dismissCookieDialog(page);

    await expect(page.getByTestId("landing-hero-brand")).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /számláz|invoic/i,
    );

    if (testInfo.project.name.includes("mobile")) {
      await page.getByTestId("landing-menu-toggle").click();
      await page.getByTestId("landing-mobile-blog").click();
    } else {
      await page.getByTestId("landing-nav-blog").click();
    }
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.getByTestId("blog-index-page")).toBeVisible();

    await page.getByTestId("blog-home-link").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("landing-page")).toBeVisible();
  });

  test("sitemap.xml and robots.txt are available", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain("<urlset");
    expect(sitemapBody).toContain("/blog");
    expect(sitemapBody).toContain("/blog/magyar-szamlazas-alapok");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("User-agent:");
    expect(robotsBody).toContain("Sitemap:");
  });
});
