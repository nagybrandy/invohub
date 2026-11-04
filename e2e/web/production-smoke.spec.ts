// e2e/web/production-smoke.spec.ts
// Smoke tests against the deployed production site (no local dev server).
import { test, expect } from "@playwright/test";

const productionBaseUrl =
  process.env.PRODUCTION_BASE_URL ?? "https://invohub.vercel.app";

test.describe("Production smoke", () => {
  test.use({ baseURL: productionBaseUrl });

  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("invohub");
  });

  test("entry javascript bundle loads", async ({ request }) => {
    const appRoute = await request.get("/login");
    expect(appRoute.ok()).toBeTruthy();

    const html = await appRoute.text();
    const match = html.match(/\/_expo\/static\/js\/web\/entry-[^"]+\.js/);
    expect(match).not.toBeNull();

    const response = await request.get(match![0]);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("javascript");
  });

  test("static marketing assets are served", async ({ request }) => {
    const stylesheet = await request.get("/marketing/assets/site.css");
    expect(stylesheet.ok()).toBeTruthy();
    expect(stylesheet.headers()["content-type"]).toContain("text/css");

    const mark = await request.get("/marketing/assets/mark-inverse.svg");
    expect(mark.ok()).toBeTruthy();
  });

  test("primary call to action navigates to login", async ({ page }) => {
    await page.goto("/");

    const essentialOnly = page.getByTestId("cookie-consent-essential");
    const dialogAppeared = await essentialOnly
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (dialogAppeared) {
      await essentialOnly.click();
    }

    // The hero CTA is the one button that stays visible at every breakpoint.
    await page.getByTestId("landing-hero-cta").click();
    await expect(page).toHaveURL(/login/);
  });

  test("home page serves the redesigned app landing", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await expect(page.getByTestId("landing-hero")).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});
