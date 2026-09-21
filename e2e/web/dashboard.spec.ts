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

  authTest("header no longer shows the mislabelled incoming invoices button", async ({
    page,
  }) => {
    // The desktop header used to show a "Bejövő számlák" (incoming
    // invoices) button that actually opened the *outgoing* unpaid list —
    // removed (not relabelled) by slice/incoming-invoices-dashboard-button;
    // see docs/decisions/2026-09-21-no-incoming-invoice-screen-yet.md. The
    // same destination stays reachable via the "Kintlévőség" KPI card.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /Bejövő számlák/ })
    ).toHaveCount(0);
  });

  authTest("header actions show customer service button in the ⋯ menu", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("overflow-menu-trigger").first().click();
    await expect(
      page.getByRole("button", { name: /Ügyfélszolgálat/ })
    ).toBeVisible();
  });
});

// The redesigned dashboard (A1-A7): clickable KPIs, a real chart instead of
// a legend with nothing behind it, an honest VAT caption, and the M2M demo
// panel collapsed at the bottom.
authTest.describe("Dashboard KPIs and layout (redesign)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("all 4 KPI cards are clickable and navigate to a filtered invoice list", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("stat-card-press").filter({ hasText: "Lejárt" }).click();
    await page.waitForURL(/\/invoices/);
    expect(page.url()).toContain("status=overdue");
  });

  authTest("the estimated-VAT caption names the period and disclaims tax advice", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Nem adótanácsadás")).toBeVisible();
  });

  authTest("shows a revenue split bar instead of a legend with no chart", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("dashboard-revenue-bar")).toBeVisible();
  });

  authTest("Következő lépések card renders", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Következő lépések")).toBeVisible();
  });

  authTest("M2M diagnostics panel is collapsed by default and labeled (demó)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("m2m-demo-card")).toBeVisible();
    await expect(page.getByTestId("m2m-demo-content")).toHaveCount(0);
    await expect(page.getByText("Fejlesztői diagnosztika (demó)")).toBeVisible();
  });
});
