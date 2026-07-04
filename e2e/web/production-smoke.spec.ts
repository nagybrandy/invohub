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
    const home = await request.get("/");
    expect(home.ok()).toBeTruthy();

    const html = await home.text();
    const match = html.match(/\/_expo\/static\/js\/web\/entry-[^"]+\.js/);
    expect(match).not.toBeNull();

    const response = await request.get(match![0]);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("javascript");
  });

  test("get started navigates to login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/login/);
  });

  test("home page loads", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("body")).toBeVisible();
  });
});
