// e2e/web/receipts.spec.ts
// Receipt E2E tests (2026-11 redesign). Receipts are ISSUED documents (strictly
// numbered), so the authenticated specs here only read the list and look at the
// new-receipt form: nothing presses "Nyugta kiállítása".
import { test, expect } from "@playwright/test";
import { test as authTest, hasE2ECredentials } from "./fixtures/auth";

test.describe("Receipt management", () => {
  test.describe("Auth guard", () => {
    test("receipts list redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/receipts");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });

    test("new receipt page redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/receipts/new");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });

    test("receipt detail page redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/receipts/some-id");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });
  });
});

authTest.describe("Receipts list (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  authTest("shows the title, the new-receipt action and the table", async ({ page }) => {
    await page.goto("/receipts");
    await expect(page.getByRole("heading", { name: "Nyugták" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("receipts-new")).toBeVisible();
    await expect(page.getByTestId("receipts-search")).toBeVisible();
    // An account with no receipts shows an empty state instead of the table.
    await expect(
      page.getByTestId("receipt-list-table").or(page.getByText("Még nincsenek nyugták"))
    ).toBeVisible({ timeout: 30_000 });
  });

  authTest("the table has Sorszám / Vevő / Kelt / Összeg columns and NAV state per row", async ({ page }) => {
    await page.goto("/receipts");
    const table = page.getByTestId("receipt-list-table");
    await expect(table).toBeVisible({ timeout: 60_000 });
    authTest.skip((await page.getByTestId("list-table-row").count()) === 0, "No receipts in this account.");
    for (const header of ["Sorszám", "Vevő", "Kelt", "Összeg"]) {
      await expect(table.getByText(header, { exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("receipt-list-stats")).toBeVisible();
  });

  authTest("search narrows the list", async ({ page }) => {
    await page.goto("/receipts");
    await expect(page.getByTestId("receipt-list-table")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("receipts-search").fill("zzz-no-such-receipt-zzz");
    await expect(page.getByTestId("list-table-row")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText("Nincs találat")).toBeVisible();
  });

  authTest("'Új nyugta' opens the new-receipt form", async ({ page }) => {
    await page.goto("/receipts");
    await page.getByTestId("receipts-new").click({ timeout: 60_000 });
    await page.waitForURL(/\/receipts\/new/);
    await expect(page.getByTestId("composer-section-receipt-details")).toBeVisible({ timeout: 60_000 });
  });
});

authTest.describe("New receipt form (authenticated, never submitted)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  async function openForm(page: import("@playwright/test").Page) {
    await page.goto("/receipts/new");
    await expect(page.getByTestId("composer-section-receipt-details")).toBeVisible({ timeout: 60_000 });
  }

  authTest("has a system-assigned number, no customer-name field, and the issue button", async ({ page }) => {
    await openForm(page);
    await expect(page.getByRole("heading", { name: "Új nyugta kiállítása" })).toBeVisible();
    await expect(page.getByText("A nyugta sorszámát a rendszer adja ki")).toBeVisible();
    await expect(page.getByText("Ügyfél neve")).toHaveCount(0);
    await expect(page.getByTestId("receipt-payment-method")).toBeVisible();
    await expect(page.getByTestId("receipt-language")).toBeVisible();
    // Only checked for presence: pressing it would issue a numbered receipt.
    await expect(page.getByTestId("receipt-create")).toBeVisible();
  });

  authTest("entry mode switches between Egyszerű and Részletes", async ({ page }) => {
    await openForm(page);
    await page.getByTestId("receipt-mode-simple").click();
    await expect(page.getByTestId("receipt-total-amount")).toBeVisible();
    await page.getByTestId("receipt-mode-detailed").click();
    await expect(page.getByTestId("receipt-item-0-description")).toBeVisible();
    await expect(page.getByTestId("receipt-add-item")).toBeVisible();
  });

  authTest("a line can be added and removed in the detailed mode, and the totals follow", async ({ page }) => {
    await openForm(page);
    await page.getByTestId("receipt-mode-detailed").click();
    await page.getByTestId("receipt-add-item").click();
    await expect(page.getByTestId("receipt-item-1-row")).toBeVisible();
    await page.getByTestId("receipt-item-1-delete").click();
    await expect(page.getByTestId("receipt-item-1-row")).toHaveCount(0);

    await page.getByTestId("receipt-item-0-unitPrice").fill("10000");
    await expect(page.getByTestId("composer-bottom-totals")).toContainText(/12[\s,.\u00a0]?700/);
  });
});
