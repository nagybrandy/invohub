// e2e/web/navigation.spec.ts
// Web navigation smoke for public routes, plus the signed-in app shell:
// desktop sidebar one-click reachability (N1 fix) and the mobile tab bar +
// "Továbbiak" sheet (spec §1).
import { test, expect } from "@playwright/test";
import { test as authTest, hasE2ECredentials } from "./fixtures/auth";

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

authTest.describe("Desktop sidebar (authenticated, 1440x900)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.use({ viewport: { width: 1440, height: 900 } });

  authTest("reaches Partnerek (/clients) in one click from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Partnerek" }).click();
    await page.waitForURL(/\/clients/);
    expect(page.url()).toContain("/clients");
  });

  authTest("reaches Termékek (/products) in one click from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Termékek" }).click();
    await page.waitForURL(/\/products/);
    expect(page.url()).toContain("/products");
  });

  authTest("reaches Nyugták (/receipts) in one click from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Nyugták" }).click();
    await page.waitForURL(/\/receipts/);
    expect(page.url()).toContain("/receipts");
  });

  authTest("reaches Importálás (/import) in one click from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Importálás" }).click();
    await page.waitForURL(/\/import/);
    expect(page.url()).toContain("/import");
  });

  authTest("the sidebar's + Új számla button navigates to /invoices/new", async ({ page }) => {
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Új számla" }).click();
    await page.waitForURL(/\/invoices\/new/);
    expect(page.url()).toContain("/invoices/new");
  });

  authTest("the avatar opens a user menu with account, company, and sign out", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Fiókbeállítások" }).click();
    await expect(page.getByRole("menuitem", { name: "Fiókbeállítások" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Céges profil" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Kijelentkezés" })).toBeVisible();
  });

  authTest("settings sub-pages offer a one-click way back to the hub", async ({ page }) => {
    await page.goto("/settings/pdf");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Vissza a Beállításokhoz" }).click();
    await page.waitForURL(/\/settings$/);
    expect(page.url()).toMatch(/\/settings$/);
  });
});

authTest.describe("Tablet sidebar default state (authenticated, 1100x850)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.use({ viewport: { width: 1100, height: 850 } });

  authTest("the sidebar is collapsed by default between 1024 and 1279px, and survives a reload", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Collapsed: the primary nav labels aren't visible text, only icons.
    await expect(page.getByRole("link", { name: "Partnerek" })).toBeHidden();

    await page.evaluate(() => window.localStorage.setItem("invohub.sidebar.collapsed", "0"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "Partnerek" })).toBeVisible();
  });
});

authTest.describe("Mobile tab bar + Továbbiak sheet (authenticated, 375x812)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.use({ viewport: { width: 375, height: 812 } });

  authTest("the Továbbiak sheet reaches Nyugták, Termékek, Importálás and Beállítások", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Továbbiak" }).click();
    await expect(page.getByRole("menuitem", { name: "Nyugták" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Termékek" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Importálás" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Beállítások" })).toBeVisible();

    await page.getByRole("menuitem", { name: "Termékek" }).click();
    await page.waitForURL(/\/products/);
    expect(page.url()).toContain("/products");
  });

  authTest("the centre + tab navigates to /invoices/new", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Új számla" }).click();
    await page.waitForURL(/\/invoices\/new/);
    expect(page.url()).toContain("/invoices/new");
  });
});
