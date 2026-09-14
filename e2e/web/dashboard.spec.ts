// e2e/web/dashboard.spec.ts
// Dashboard E2E tests.
import { test, expect } from "@playwright/test";
import { test as authTest, hasE2ECredentials } from "./fixtures/auth";

test.describe("Dashboard", () => {
  test.describe("Auth guard", () => {
    test("dashboard redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });
  });
});

authTest.describe("Dashboard UI (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("dashboard page loads with title", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Áttekintés")).toBeVisible();
    await expect(
      page.getByText("Számlázási és megfelelőségi tevékenység áttekintése.")
    ).toBeVisible();
  });

  authTest("revenue stat card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Bevétel statisztika")).toBeVisible();
    await expect(page.getByText("Fizetve")).toBeVisible();
    await expect(page.getByText("Kiállítva")).toBeVisible();
    await expect(page.getByText("Kintlévő")).toBeVisible();
  });

  authTest("VAT estimate card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Becsült fizetendő ÁFA")).toBeVisible();
  });

  authTest("overdue debt card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Lejárt tartozás")).toBeVisible();
  });

  authTest("recent invoices section renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Legutóbbi számlák")).toBeVisible();
    await expect(page.getByText("Minden kimenő számla")).toBeVisible();
  });

  authTest("recent invoices table shows column headers on desktop", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Sorszám")).toBeVisible();
    await expect(page.getByText("Partner")).toBeVisible();
    await expect(page.getByText("Fizetési státusz")).toBeVisible();
    await expect(page.getByText("Kelt")).toBeVisible();
    await expect(page.getByText("Bruttó összeg")).toBeVisible();
  });

  authTest("feature link grid renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Összes funkció")).toBeVisible();
  });

  authTest("header actions show incoming invoices button", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /Bejövő számlák/ })
    ).toBeVisible();
  });

  authTest("header actions show customer service button", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /Ügyfélszolgálat/ })
    ).toBeVisible();
  });
});
