// e2e/web/dashboard.spec.ts
// Dashboard E2E tests.
import { test, expect } from "@playwright/test";

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

test.describe("Dashboard UI (authenticated)", () => {
  // TODO: Requires test user authentication setup

  test.skip("dashboard page loads with title", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Áttekintés")).toBeVisible();
    await expect(
      page.getByText("Számlázási és megfelelőségi tevékenység áttekintése.")
    ).toBeVisible();
  });

  test.skip("revenue stat card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Bevétel statisztika")).toBeVisible();
    await expect(page.getByText("Fizetve")).toBeVisible();
    await expect(page.getByText("Kiállítva")).toBeVisible();
    await expect(page.getByText("Kintlévő")).toBeVisible();
  });

  test.skip("VAT estimate card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Becsült fizetendő ÁFA")).toBeVisible();
  });

  test.skip("overdue debt card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Lejárt tartozás")).toBeVisible();
  });

  test.skip("recent invoices section renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Legutóbbi számlák")).toBeVisible();
    await expect(page.getByText("Minden kimenő számla")).toBeVisible();
  });

  test.skip("recent invoices table shows column headers on desktop", async ({
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

  test.skip("feature link grid renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Összes funkció")).toBeVisible();
  });

  test.skip("header actions show incoming invoices button", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /Bejövő számlák/ })
    ).toBeVisible();
  });

  test.skip("header actions show customer service button", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /Ügyfélszolgálat/ })
    ).toBeVisible();
  });
});
