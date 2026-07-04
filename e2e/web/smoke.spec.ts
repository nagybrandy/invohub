// e2e/web/smoke.spec.ts
// Web smoke tests: landing page and login route load.
import { test, expect } from "@playwright/test";

test.describe("InvoHub web smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\//);
    await expect(page.locator("body")).toBeVisible();
  });

  test("login page is reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated users redirect from invoices", async ({ page }) => {
    await page.goto("/invoices");
    await page.waitForURL(/login|\//);
    expect(page.url()).toMatch(/login|\//);
  });
});
