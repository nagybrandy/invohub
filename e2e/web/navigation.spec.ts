// e2e/web/navigation.spec.ts
// Web navigation smoke for public routes, plus the signed-in app shell of the
// 2026-11 redesign (SPEC §4/§5): the navy desktop sidebar with its "Új számla"
// split button, the account menu, and the mobile tab bar with the "Új" and
// "Továbbiak" sheets. Read-only: no sign-out, no account switch, nothing created.
import { test, expect, type Page } from "@playwright/test";
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
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  async function openDashboard(page: Page) {
    await page.goto("/dashboard");
    await expect(page.getByTestId("app-sidebar")).toBeVisible({ timeout: 60_000 });
  }

  const DESTINATIONS: Array<{ id: string; label: string; url: RegExp }> = [
    { id: "invoices", label: "Számlák", url: /\/invoices/ },
    { id: "receipts", label: "Nyugták", url: /\/receipts/ },
    { id: "partners", label: "Partnerek", url: /\/clients/ },
    { id: "products", label: "Termékek", url: /\/products/ },
    { id: "settings", label: "Beállítások", url: /\/settings/ },
    { id: "emailEditor", label: "E-mail szerkesztő", url: /\/settings\/templates/ },
    { id: "dataExport", label: "Adatexport", url: /\/export/ },
    { id: "bulkUpload", label: "Tömeges feltöltés", url: /\/bulk/ },
  ];

  authTest("lists Főoldal plus every section (E-mail szerkesztő opens its settings page), each one click away", async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId("sidebar-nav-dashboard")).toContainText("Főoldal");
    for (const dest of DESTINATIONS) {
      await expect(page.getByTestId(`sidebar-nav-${dest.id}`)).toContainText(dest.label);
    }
    for (const dest of DESTINATIONS) {
      await page.getByTestId(`sidebar-nav-${dest.id}`).click();
      await expect(page).toHaveURL(dest.url, { timeout: 30_000 });
    }
  });

  authTest("the sidebar's 'Új számla' button opens the composer from any screen", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByTestId("new-create-main")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("new-create-main").click();
    await page.waitForURL(/\/invoices\/new/);
  });

  authTest("the arrow next to it offers invoice, receipt and partner", async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId("new-create-arrow").click();
    await expect(page.getByTestId("new-create-invoice")).toBeVisible();
    await expect(page.getByTestId("new-create-receipt")).toBeVisible();
    await expect(page.getByTestId("new-create-partner")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  authTest("the account button opens a menu with company settings and sign-out (not pressed)", async ({
    page,
  }) => {
    await openDashboard(page);
    await page.getByTestId("sidebar-account-button").click();
    await expect(page.getByTestId("account-menu")).toBeVisible();
    await expect(page.getByTestId("account-sign-out")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  authTest("the top strip has the global search and the notification bell", async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId("app-topstrip")).toBeVisible();
    await expect(page.getByTestId("global-search")).toBeVisible();
    await expect(page.getByTestId("notification-bell")).toBeVisible();
  });

  authTest("the sidebar collapses to icons and expands again", async ({ page }) => {
    await openDashboard(page);
    const sidebar = page.getByTestId("app-sidebar");
    const width = async () => (await sidebar.boundingBox())?.width ?? 0;
    const full = await width();
    expect(full).toBeGreaterThan(200);
    await page.getByTestId("sidebar-collapse-toggle").click();
    await expect.poll(width).toBeLessThan(120);
    await page.getByTestId("sidebar-collapse-toggle").click();
    await expect.poll(width).toBeGreaterThan(200);
  });
});

authTest.describe("Mobile tab bar (authenticated, 375x812)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 375, height: 812 } });

  async function openDashboard(page: Page) {
    await page.goto("/dashboard");
    await expect(page.getByTestId("mobile-tab-bar")).toBeVisible({ timeout: 60_000 });
  }

  authTest("has Főoldal, Számlák, Új, Partnerek and Továbbiak tabs", async ({ page }) => {
    await openDashboard(page);
    const bar = page.getByTestId("mobile-tab-bar");
    for (const label of ["Főoldal", "Számlák", "Partnerek", "Továbbiak"]) {
      await expect(bar.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("tab-new")).toBeVisible();
  });

  authTest("the Továbbiak sheet reaches Nyugták, Termékek, Beállítások and sign-out (not pressed)", async ({
    page,
  }) => {
    await openDashboard(page);
    await page.getByTestId("tab-more").click();
    await expect(page.getByTestId("more-sheet")).toBeVisible();
    for (const id of ["receipts", "products", "settings"]) {
      await expect(page.getByTestId(`more-sheet-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("more-sheet-sign-out")).toBeVisible();

    await page.getByTestId("more-sheet-products").click();
    await page.waitForURL(/\/products/);
  });

  authTest("the centre + tab offers a new invoice", async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId("tab-new").click();
    await expect(page.getByTestId("new-sheet")).toBeVisible();
    await page.getByTestId("new-sheet-invoice").click();
    await page.waitForURL(/\/invoices\/new/);
  });
});
