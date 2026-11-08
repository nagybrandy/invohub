// e2e/web/settings.spec.ts
// Settings E2E tests (2026-11 redesign, SPEC §9): at desktop width the frame has
// a left menu (settings-nav-*) beside the page; /settings opens Céges profil.
//
// SAFETY: these specs may run against a database with real data. They only
// navigate (through the menu, not deep links, so they also hold where a deep
// link bounces to Céges profil), read, and open pages. Nothing is typed into a
// settings form or saved: no company, NAV, billing, template, reminder,
// API-key or access change, no sign-out, no invitation.
import { test, expect, type Page } from "@playwright/test";
import { test as authTest, hasE2ECredentials } from "./fixtures/auth";

test.describe("Settings", () => {
  test.describe("Auth guard", () => {
    test("settings hub redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/settings");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });

    test("company settings redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/settings/company");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });
  });
});

const SETTINGS_PAGES = [
  { id: "company", label: "Céges profil", url: /\/settings\/company/ },
  { id: "billing", label: "Számlázási beállítások", url: /\/settings\/billing/ },
  { id: "pdf", label: "Számla testreszabása", url: /\/settings\/pdf/ },
  { id: "templates", label: "E-mailek szövege", url: /\/settings\/templates/ },
  { id: "reminders", label: "Kiküldés és emlékeztetők", url: /\/settings\/reminders/ },
  { id: "nav", label: "NAV", url: /\/settings\/nav/ },
  { id: "access", label: "Számlázófiókok és hozzáférés", url: /\/settings\/access/ },
  { id: "appearance", label: "Nyelv és megjelenés", url: /\/settings\/appearance/ },
  { id: "apiKeys", label: "API kulcsok", url: /\/settings\/api-keys/ },
] as const;

authTest.describe("Settings frame (authenticated, desktop)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  async function openSettings(page: Page) {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-nav-column")).toBeVisible({ timeout: 60_000 });
  }

  authTest("/settings shows the left menu with every page and opens Céges profil", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByTestId("settings-pane")).toBeVisible();
    for (const entry of SETTINGS_PAGES) {
      await expect(page.getByTestId(`settings-nav-${entry.id}`)).toContainText(entry.label);
    }
    await expect(page).toHaveURL(/\/settings\/company/);
  });

  for (const entry of SETTINGS_PAGES) {
    authTest(`the menu opens ${entry.label}`, async ({ page }) => {
      await openSettings(page);
      await page.getByTestId(`settings-nav-${entry.id}`).click();
      await expect(page).toHaveURL(entry.url, { timeout: 30_000 });
      await expect(page.getByTestId("settings-pane")).toBeVisible();
      // A missing translation renders its dotted key — none may be on the page.
      await expect(
        page.getByTestId("settings-pane").getByText(/\b(settings|billing|reminders|accounts|apiKeys)\.[a-zA-Z]+\.[a-zA-Z.]+/)
      ).toHaveCount(0);
    });
  }

  authTest("the menu search narrows the list", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("settings-search").fill("NAV");
    await expect(page.getByTestId("settings-nav-nav")).toBeVisible();
    await expect(page.getByTestId("settings-nav-apiKeys")).toHaveCount(0);
  });

  authTest("Céges profil shows the company form fields (not saved)", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("settings-nav-company").click();
    await expect(page.getByTestId("settings-company")).toBeVisible({ timeout: 30_000 });
    for (const id of [
      "company-tax-number",
      "company-name",
      "company-address",
      "company-city",
      "company-zip",
      "company-bank-account",
      "company-vat-exempt",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  authTest("Nyelv és megjelenés: the theme cards switch light and dark (browser-local only)", async ({
    page,
  }) => {
    await openSettings(page);
    await page.getByTestId("settings-nav-appearance").click();
    await expect(page.getByTestId("theme-cards")).toBeVisible({ timeout: 30_000 });
    const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));

    await page.getByTestId("theme-cards-dark").click();
    await expect.poll(isDark).toBe(true);
    await page.getByTestId("theme-cards-light").click();
    await expect.poll(isDark).toBe(false);
  });
});

authTest.describe("Settings start list (authenticated, mobile 375x812)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 375, height: 812 } });

  authTest("/settings is the grouped list; a subpage has a back link to it", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-start-list")).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/settings$/);
    // Read-only: only the "Céges profil" row is opened; the list also carries sign-out
    // and demo-data buttons, which this spec never touches.
    await page.getByRole("button", { name: /^Céges profil/ }).click();
    await expect(page).toHaveURL(/\/settings\/company/);
    await page.getByTestId("settings-back-link").click();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
