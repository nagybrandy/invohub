// e2e/web/auth.spec.ts
// Authentication flow E2E tests.
import { test, expect } from "@playwright/test";

test.describe("Authentication flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Login page rendering", () => {
    test("displays welcome heading", async ({ page }) => {
      await expect(page.getByText("Üdv újra!")).toBeVisible();
    });

    test("shows email input field", async ({ page }) => {
      await expect(
        page.getByRole("textbox", { name: /e-mail/i })
      ).toBeVisible();
    });

    test("shows password input field", async ({ page }) => {
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test("shows sign-in button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Bejelentkezés" })
      ).toBeVisible();
    });

    test("shows link to create account", async ({ page }) => {
      await expect(
        page.getByText("Nincs fiókod? Regisztrálj")
      ).toBeVisible();
    });

    test("shows back to home link", async ({ page }) => {
      await expect(
        page.getByText("Vissza a főoldalra")
      ).toBeVisible();
    });
  });

  test.describe("Sign-up form", () => {
    test.beforeEach(async ({ page }) => {
      await page.getByText("Nincs fiókod? Regisztrálj").click();
    });

    test("switches to sign-up mode with correct heading", async ({ page }) => {
      await expect(page.getByText("Fiók létrehozása")).toBeVisible();
    });

    test("shows name field", async ({ page }) => {
      await expect(page.getByText("Név")).toBeVisible();
      await expect(
        page.getByPlaceholder("Kovács Anna")
      ).toBeVisible();
    });

    test("shows email and password fields", async ({ page }) => {
      await expect(
        page.getByPlaceholder("te@pelda.hu")
      ).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test("shows sign-up button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Regisztráció" })
      ).toBeVisible();
    });

    test("shows link back to sign-in", async ({ page }) => {
      await expect(
        page.getByText("Már van fiókod? Jelentkezz be")
      ).toBeVisible();
    });
  });

  test.describe("Tab switching", () => {
    test("can switch from sign-in to sign-up and back", async ({ page }) => {
      await expect(page.getByText("Üdv újra!")).toBeVisible();

      await page.getByText("Nincs fiókod? Regisztrálj").click();
      await expect(page.getByText("Fiók létrehozása")).toBeVisible();

      await page.getByText("Már van fiókod? Jelentkezz be").click();
      await expect(page.getByText("Üdv újra!")).toBeVisible();
    });
  });

  test.describe("Form validation", () => {
    test("shows error on empty credentials submission", async ({ page }) => {
      await page.getByRole("button", { name: "Bejelentkezés" }).click();
      await page.waitForTimeout(2000);
      const errorText = page.locator('[class*="destructive"]');
      // TODO: Requires running auth backend; error message depends on server response
      await expect(errorText.first()).toBeVisible({ timeout: 5000 });
    });
  });
});
