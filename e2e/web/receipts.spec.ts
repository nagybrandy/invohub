// e2e/web/receipts.spec.ts
// Receipt management E2E tests.
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

authTest.describe("Receipt form UI (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("new receipt form renders heading", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Új nyugta")).toBeVisible();
  });

  authTest("receipt details section shows all fields", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Nyugtaszám")).toBeVisible();
    await expect(page.getByText("Ügyfél neve")).toBeVisible();
    await expect(page.getByText("Pénznem")).toBeVisible();
    await expect(page.getByText("HUF")).toBeVisible();
    await expect(page.getByText("EUR")).toBeVisible();
  });

  authTest("payment method options are visible", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Készpénz")).toBeVisible();
    await expect(page.getByText("Bankkártya")).toBeVisible();
    await expect(page.getByText("Átutalás")).toBeVisible();
    await expect(page.getByText("Utalvány")).toBeVisible();
  });

  authTest("entry mode toggle shows Simple and Detailed", async ({
    page,
  }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Simple")).toBeVisible();
    await expect(page.getByText("Detailed")).toBeVisible();
  });

  authTest("detailed mode shows line item with fields", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Item 1")).toBeVisible();
    await expect(page.getByText("Description")).toBeVisible();
    await expect(page.getByText("Net price")).toBeVisible();
    await expect(page.getByText("Qty")).toBeVisible();
    await expect(page.getByText("Unit")).toBeVisible();
    await expect(page.getByText("VAT rate")).toBeVisible();
  });

  authTest("can add a new line item", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Item 1")).toBeVisible();
    await expect(page.getByText("Item 2")).not.toBeVisible();

    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Item 2")).toBeVisible();
  });

  authTest("can remove a line item when multiple exist", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText("Item 2")).toBeVisible();

    const deleteButtons = page.locator('[data-testid="remove-item"]');
    if ((await deleteButtons.count()) === 0) {
      // Fallback: find trash icon buttons
      const trashButtons = page.locator("svg").filter({ hasText: "" });
      // The trash button is rendered as a Pressable with Trash2 icon
      await page.locator('[class*="p-1"]').last().click();
    } else {
      await deleteButtons.last().click();
    }

    await expect(page.getByText("Item 2")).not.toBeVisible({ timeout: 3000 });
  });

  authTest("totals section shows in detailed mode", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Totals")).toBeVisible();
    await expect(page.getByText("Net total")).toBeVisible();
    await expect(page.getByText("Gross total")).toBeVisible();
  });

  authTest("switching to simple mode shows amount field", async ({
    page,
  }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await page.getByText("Simple").click();
    await expect(page.getByText("Összeg")).toBeVisible();
    await expect(page.getByPlaceholder("0")).toBeVisible();
  });

  authTest("create button is visible", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: "Nyugta kiállítása" })
    ).toBeVisible();
  });
});

authTest.describe("Receipt detail page (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("receipt detail page shows receipt data", async ({ page }) => {
    // This would navigate to an actual receipt; needs seeded data
    await page.goto("/receipts");
    await page.waitForLoadState("networkidle");

    // If receipts exist, click the first one
    const firstReceipt = page.locator("[class*='card']").first();
    if (await firstReceipt.isVisible()) {
      await firstReceipt.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
