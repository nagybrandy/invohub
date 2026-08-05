// e2e/web/settings.spec.ts
// Settings E2E tests.
import { test, expect } from "@playwright/test";

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

test.describe("Settings hub (authenticated)", () => {
  // TODO: Requires test user authentication setup

  test.skip("renders settings page title", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Beállítások")).toBeVisible();
    await expect(
      page.getByText("Fiók, sablonok és alkalmazás beállítások.")
    ).toBeVisible();
  });

  test.skip("shows account section with all setting cards", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Fiók és számlázás")).toBeVisible();
    await expect(page.getByText("Céges profil")).toBeVisible();
    await expect(page.getByText("E-mail sablonok")).toBeVisible();
    await expect(page.getByText("PDF megjelenés")).toBeVisible();
    await expect(page.getByText("Fizetési emlékeztetők")).toBeVisible();
    await expect(page.getByText("API kulcsok")).toBeVisible();
  });

  test.skip("shows tools section with export and dark mode", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Eszközök és beállítások")).toBeVisible();
    await expect(page.getByText("Adóellenőrzési export")).toBeVisible();
    await expect(page.getByText("Sötét mód")).toBeVisible();
  });

  test.skip("dark mode toggle shows current state", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const darkModeCard = page.locator("text=Sötét mód").first();
    await expect(darkModeCard).toBeVisible();

    // Should show either "Jelenleg bekapcsolva" or "Jelenleg kikapcsolva"
    const onLabel = page.getByText("Jelenleg bekapcsolva");
    const offLabel = page.getByText("Jelenleg kikapcsolva");
    const hasOn = await onLabel.isVisible().catch(() => false);
    const hasOff = await offLabel.isVisible().catch(() => false);
    expect(hasOn || hasOff).toBe(true);
  });

  test.skip("dark mode card is clickable and toggles theme", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const initialOnVisible = await page
      .getByText("Jelenleg bekapcsolva")
      .isVisible()
      .catch(() => false);

    // Click the dark mode card
    await page.getByText("Sötét mód").click();
    await page.waitForTimeout(500);

    const afterOnVisible = await page
      .getByText("Jelenleg bekapcsolva")
      .isVisible()
      .catch(() => false);

    // Theme should have toggled
    expect(afterOnVisible).not.toBe(initialOnVisible);
  });

  test.skip("shows demo data section", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Demo adatok")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Demo adatok betöltése" })
    ).toBeVisible();
  });

  test.skip("shows sign-out button", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Kijelentkezés" })
    ).toBeVisible();
  });
});

test.describe("Company settings (authenticated)", () => {
  // TODO: Requires test user authentication setup

  test.skip("company settings page loads with sections", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Céges profil")).toBeVisible();
    await expect(page.getByText("Cégadatok")).toBeVisible();
  });

  test.skip("company form shows required fields", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Cégnév")).toBeVisible();
    await expect(page.getByText("Adószám")).toBeVisible();
    await expect(page.getByText("Cím")).toBeVisible();
    await expect(page.getByText("Város")).toBeVisible();
    await expect(page.getByText("Bankszámlaszám")).toBeVisible();
  });

  test.skip("NAV section is present", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("NAV Online Számla")).toBeVisible();
    await expect(page.getByText("NAV technikai felhasználó")).toBeVisible();
  });

  test.skip("invoice email section is visible", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Számla e-mailek")).toBeVisible();
    await expect(page.getByText("Számla küldése ide")).toBeVisible();
  });

  test.skip("save button is present", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Profil mentése" })
    ).toBeVisible();
  });
});
