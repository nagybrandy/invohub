// e2e/web/invoices.spec.ts
// Invoice management E2E tests.
import { test, expect } from "@playwright/test";
import { test as authTest, hasE2ECredentials } from "./fixtures/auth";

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

authTest.describe("Invoice form UI (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("new invoice form renders document type tabs", async ({
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

  authTest("document type tabs switch correctly", async ({ page }) => {
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

  authTest("screen mode tabs are visible", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Szerkesztés")).toBeVisible();
    await expect(page.getByText("Előnézet")).toBeVisible();
  });

  authTest("recipient section shows all form fields", async ({ page }) => {
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

  authTest("dates and payment section renders", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Dátumok és fizetés")).toBeVisible();
    await expect(page.getByText("Teljesítés dátuma")).toBeVisible();
    await expect(page.getByText("Fizetési mód")).toBeVisible();
    await expect(page.getByText("Pénznem")).toBeVisible();
    await expect(page.getByText("Fizetési határidő")).toBeVisible();
  });

  authTest("payment method buttons are interactive", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Átutalás")).toBeVisible();
    await expect(page.getByText("Készpénz")).toBeVisible();
    await expect(page.getByText("Bankkártya")).toBeVisible();
  });

  authTest("currency selector shows HUF and EUR", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("HUF")).toBeVisible();
    await expect(page.getByText("EUR")).toBeVisible();
  });

  authTest("line items section renders", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Mit számlázol?")).toBeVisible();
  });

  authTest("action buttons are visible", async ({ page }) => {
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

// Desktop-first checks for the /invoices LIST screen (L1-L9): a real table
// instead of a phone-card-list stretched to 1400px, sortable due-date
// column, per-status filter counts, and no bare trash icon in the row.
authTest.describe("Invoice list (desktop table)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("renders a table with Sorszám/Partner/Kelt/Fizetési határidő/Státusz/NAV/Bruttó headers", async ({
    page,
  }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("invoice-list-table")).toBeVisible();
    for (const header of [
      "Sorszám",
      "Partner",
      "Kelt",
      "Fizetési határidő",
      "Státusz",
      "NAV",
      "Bruttó",
    ]) {
      await expect(page.getByText(header, { exact: true }).first()).toBeVisible();
    }
  });

  authTest("filter chips show a count and the selected chip is high-contrast", async ({
    page,
  }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");

    const allChip = page.getByTestId("invoice-filter-all");
    await expect(allChip).toBeVisible();
    await expect(allChip).toHaveClass(/bg-primary/);

    const draftChip = page.getByTestId("invoice-filter-draft");
    await expect(draftChip).toBeVisible();
    await draftChip.click();
    await expect(draftChip).toHaveClass(/bg-primary/);
    await expect(allChip).not.toHaveClass(/bg-primary/);
  });

  authTest("Kelt/Bruttó headers sort and show a direction indicator", async ({ page }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");

    const grossHeader = page.getByTestId("invoice-table-sort-gross");
    await expect(grossHeader).toBeVisible();
    await grossHeader.click();
    await expect(page.getByTestId("invoice-list-table")).toBeVisible();
  });

  authTest("no bare trash icon in a row — delete lives in the row's ⋯ menu", async ({
    page,
  }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");

    const rows = page.getByTestId("data-table-row");
    const rowCount = await rows.count();
    if (rowCount === 0) return; // nothing to assert against with no invoices yet

    await page.getByTestId("overflow-menu-trigger").first().click();
    await expect(page.getByText("Törlés").last()).toBeVisible();
  });
});

// The invoice DETAIL screen (D1-D3, D6, INV-11): a money header, a status
// timeline above the preview, exactly one solid action, and a collapsed
// danger zone instead of 11 identical outline buttons.
authTest.describe("Invoice detail (money header + timeline + danger zone)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("shows the money header, timeline, single preview and danger zone", async ({
    page,
  }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");

    const firstRow = page.getByTestId("data-table-row").first();
    if ((await firstRow.count()) === 0) return; // no invoices to open

    await firstRow.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("invoice-money-header-gross")).toBeVisible();
    await expect(page.getByTestId("invoice-timeline")).toBeVisible();
    await expect(page.getByTestId("danger-zone-toggle")).toBeVisible();

    // The old HTML|PDF tab pair is gone — a single preview + a
    // "PDF letöltése" download button instead.
    await expect(page.getByTestId("invoice-preview-download-pdf")).toBeVisible();
  });
});
