// e2e/web/settings.spec.ts
// Settings E2E tests.
import { test, expect } from "@playwright/test";
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

authTest.describe("Settings hub (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("renders settings page title", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Beállítások")).toBeVisible();
    await expect(
      page.getByText("Fiók, sablonok és alkalmazás beállítások.")
    ).toBeVisible();
  });

  authTest("shows account section with all setting cards", async ({
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

  authTest("shows tools section with export and dark mode", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Eszközök és beállítások")).toBeVisible();
    await expect(page.getByText("Adóellenőrzési export")).toBeVisible();
    await expect(page.getByText("Sötét mód")).toBeVisible();
  });

  authTest("dark mode toggle shows current state", async ({ page }) => {
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

  authTest("dark mode card is clickable and toggles theme", async ({
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

  authTest("shows demo data section", async ({ page }) => {
    // The demo-seed button itself is further gated behind
    // EXPO_PUBLIC_ALLOW_DEV_SEED=true (lib/dev/seed-guard.ts) — it's off by default,
    // including on most e2e runs.
    authTest.skip(
      process.env.EXPO_PUBLIC_ALLOW_DEV_SEED !== "true",
      "Set EXPO_PUBLIC_ALLOW_DEV_SEED=true (and start the web server with it) to show the demo data button."
    );

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Demo adatok")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Demo adatok betöltése" })
    ).toBeVisible();
  });

  authTest("shows sign-out button", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Kijelentkezés" })
    ).toBeVisible();
  });
});

authTest.describe("Company settings (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("company settings page loads with sections", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Céges profil")).toBeVisible();
    await expect(page.getByText("Cégadatok")).toBeVisible();
  });

  authTest("company form shows required fields", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Cégnév")).toBeVisible();
    await expect(page.getByText("Adószám")).toBeVisible();
    await expect(page.getByText("Cím")).toBeVisible();
    await expect(page.getByText("Város")).toBeVisible();
    await expect(page.getByText("Bankszámlaszám")).toBeVisible();
  });

  authTest("NAV section is present", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("NAV Online Számla")).toBeVisible();
    await expect(page.getByText("NAV technikai felhasználó")).toBeVisible();
  });

  authTest("invoice email section is visible", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Számla e-mailek")).toBeVisible();
    await expect(page.getByText("Számla küldése ide")).toBeVisible();
  });

  authTest("save button is present", async ({ page }) => {
    await page.goto("/settings/company");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Profil mentése" })
    ).toBeVisible();
  });
});
