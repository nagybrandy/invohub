// e2e/web/dashboard.spec.ts
// Dashboard (Főoldal) E2E tests, written against the 2026-11 redesign
// (docs/design/redesign-2026-11/SPEC.md §7.1). Authenticated tests only read:
// they never create, send, pay or delete anything (the specs may run against
// a database that holds real data).
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

authTest.describe("Főoldal (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  // The dev server compiles on first hit and the summary loads several APIs.
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  async function openDashboard(page: import("@playwright/test").Page) {
    await page.goto("/dashboard");
    // The to-do line only appears once the counts have loaded.
    await expect(summaryLine(page)).toBeVisible({ timeout: 60_000 });
  }

  // (A nested <Text> does not carry its testID on web, so the line is matched by its words.)
  const summaryLine = (page: import("@playwright/test").Page) =>
    page.getByTestId("dashboard-header").getByText(/teendő vár rád, ebből \d+ sürgős\.|Minden elintézve\./);

  authTest("shows the title and a to-do summary line, and no create buttons in the page", async ({
    page,
  }) => {
    await openDashboard(page);
    const content = page.getByTestId("screen-layout-content");
    await expect(content.getByRole("heading", { name: "Főoldal" })).toBeVisible();
    // SPEC §7.1: creating lives in the sidebar / tab bar, not on Főoldal.
    await expect(content.getByRole("button", { name: /Új számla|Új nyugta|Új partner/ })).toHaveCount(0);
    // The "···" menu only exists when a support e-mail is configured, so it is not required.
  });

  authTest("the Kintlévőség hero card shows the outstanding amount and the two stat cards", async ({
    page,
  }) => {
    await openDashboard(page);
    const hero = page.getByTestId("dashboard-grid");
    await expect(hero.getByText("Kintlévőség")).toBeVisible();
    await expect(hero.getByText(/mai állapot, \d{4}\. \d{2}\. \d{2}\./)).toBeVisible();
    await expect(hero.getByText("Beérkezett fizetések")).toBeVisible();
    await expect(hero.getByText("Becsült fizetendő ÁFA")).toBeVisible();
    // The estimate names its quarter, e.g. "2026. IV. negyedév".
    await expect(hero.getByText(/\d{4}\. [IV]+\. negyedév/)).toBeVisible();
  });

  authTest("Következő lépések lists real follow-ups or says everything is done", async ({ page }) => {
    await openDashboard(page);
    const card = page.getByTestId("dashboard-next-steps");
    await expect(card.getByText("Következő lépések")).toBeVisible();
    await expect(card.getByTestId("next-actions-rows").or(card.getByTestId("next-actions-all-clear"))).toBeVisible({
      timeout: 30_000,
    });
  });

  authTest("Legutóbbi számlák shows the latest invoices table with status pills", async ({ page }) => {
    await openDashboard(page);
    const recent = page.getByTestId("dashboard-recent");
    await expect(recent.getByText("Legutóbbi számlák")).toBeVisible();
    await expect(page.getByTestId("dashboard-recent-all")).toBeVisible();
    for (const header of ["Sorszám", "Partner", "Kelt", "Fizetési határidő", "Státusz", "NAV", "Bruttó összeg"]) {
      await expect(recent.getByText(header, { exact: true })).toBeVisible();
    }
    await expect(recent.getByTestId("invoice-status-chip").first()).toBeVisible();
  });

  authTest("the old dashboard sections and the mislabelled incoming-invoices button are gone", async ({
    page,
  }) => {
    await openDashboard(page);
    for (const gone of ["Áttekintés", "Bevétel statisztika", "Lejárt tartozás", "Összes funkció"]) {
      await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: /Bejövő számlák/ })).toHaveCount(0);
  });

  authTest("'Összes' opens the invoice list", async ({ page }) => {
    await openDashboard(page);
    await page.getByTestId("dashboard-recent-all").click();
    await page.waitForURL(/\/invoices(\?|$)/);
    await expect(page.getByTestId("invoice-list-screen")).toBeVisible({ timeout: 60_000 });
  });

  authTest("the Kintlévőség card opens the unpaid list when there is something outstanding", async ({
    page,
  }) => {
    await openDashboard(page);
    const openAll = page.getByTestId("dashboard-outstanding-open-all");
    // With nothing outstanding the card has no link (empty state); then there is nothing to open.
    authTest.skip((await openAll.count()) === 0, "No outstanding invoices in this account.");
    await openAll.click();
    await page.waitForURL(/\/invoices\?.*status=unpaid/);
  });

  authTest("the M2M diagnostics panel, when enabled, is collapsed and labelled (demó)", async ({ page }) => {
    await openDashboard(page);
    const card = page.getByTestId("m2m-demo-card");
    // Behind a flag (lib/m2m/demo-flag.ts): only check it when it is shown.
    authTest.skip((await card.count()) === 0, "M2M demo card is not enabled in this build.");
    await expect(page.getByTestId("m2m-demo-content")).toHaveCount(0);
    await expect(page.getByText("Fejlesztői diagnosztika (demó)")).toBeVisible();
  });
});
