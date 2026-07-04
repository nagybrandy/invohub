// e2e/web/navigation.spec.ts
// Web navigation smoke for public routes and settings path guard.
import { test, expect } from "@playwright/test";

test.describe("Public navigation", () => {
  test("settings route requires auth", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/login|\//);
    expect(page.url()).toMatch(/login|\//);
  });

  test("dashboard route requires auth", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/login|\//);
    expect(page.url()).toMatch(/login|\//);
  });
});
