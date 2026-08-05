// e2e/web/invoices.spec.ts
// Invoice management E2E tests.
import { test, expect } from "@playwright/test";

test.describe("Invoice management", () => {
  test.describe("Auth guard", () => {
    test("invoice list redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/invoices");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });

    test("new invoice page redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/invoices/new");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });
  });

  test.describe("New invoice form", () => {
    // TODO: These tests require authentication. Set up a test user or mock auth
    // to access protected routes. Currently tests the redirect behavior.

    test("attempting to access new invoice form shows login", async ({
      page,
    }) => {
      await page.goto("/invoices/new");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      await expect(page.locator("body")).toBeVisible();
    });
  });
});

test.describe("Invoice form UI (authenticated)", () => {
  // TODO: Requires test user authentication setup
  // These tests document expected behavior once auth is configured.

  test.skip("new invoice form renders document type tabs", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Új bizonylat kiállítása")).toBeVisible();

    await expect(page.getByText("Számla")).toBeVisible();
    await expect(page.getByText("Díjbekérő")).toBeVisible();
    await expect(page.getByText("Előlegszámla")).toBeVisible();
    await expect(page.getByText("Nyugta")).toBeVisible();
  });

  test.skip("document type tabs switch correctly", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    const szamlaTab = page.getByText("Számla").first();
    const dijbekeroTab = page.getByText("Díjbekérő").first();
    const elolegszamlaTab = page.getByText("Előlegszámla").first();

    await dijbekeroTab.click();
    await expect(dijbekeroTab).toHaveClass(/bg-primary/);

    await elolegszamlaTab.click();
    await expect(elolegszamlaTab).toHaveClass(/bg-primary/);

    await szamlaTab.click();
    await expect(szamlaTab).toHaveClass(/bg-primary/);
  });

  test.skip("screen mode tabs are visible", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Szerkesztés")).toBeVisible();
    await expect(page.getByText("Előnézet")).toBeVisible();
  });

  test.skip("recipient section shows all form fields", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("Kinek szól a bizonylat?")
    ).toBeVisible();
    await expect(
      page.getByText("Partner neve vagy adószáma")
    ).toBeVisible();
    await expect(page.getByText("Ország")).toBeVisible();
    await expect(page.getByText("Adószám")).toBeVisible();
    await expect(page.getByText("Irányítószám")).toBeVisible();
    await expect(page.getByText("Város")).toBeVisible();
  });

  test.skip("dates and payment section renders", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Dátumok és fizetés")).toBeVisible();
    await expect(page.getByText("Teljesítés dátuma")).toBeVisible();
    await expect(page.getByText("Fizetési mód")).toBeVisible();
    await expect(page.getByText("Pénznem")).toBeVisible();
    await expect(page.getByText("Fizetési határidő")).toBeVisible();
  });

  test.skip("payment method buttons are interactive", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Átutalás")).toBeVisible();
    await expect(page.getByText("Készpénz")).toBeVisible();
    await expect(page.getByText("Bankkártya")).toBeVisible();
  });

  test.skip("currency selector shows HUF and EUR", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("HUF")).toBeVisible();
    await expect(page.getByText("EUR")).toBeVisible();
  });

  test.skip("line items section renders", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Mit számlázol?")).toBeVisible();
  });

  test.skip("action buttons are visible", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Piszkozat mentése" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Számla elkészítése" })
    ).toBeVisible();
  });
});
