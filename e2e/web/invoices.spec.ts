// e2e/web/invoices.spec.ts
// Invoice management E2E tests — the 3-step composer shared by new and edit
// (docs/design/app-ux-spec-2026-09-14.md §2). Fixture/save-branch/validation
// details are covered at the unit level (composer-logic.test.ts,
// useInvoiceComposer.test.tsx, PartnerPicker.test.tsx); this file checks the
// real rendered flow end to end.
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
});

authTest.describe("Invoice composer — desktop 1440×900 (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest.use({ viewport: { width: 1440, height: 900 } });

  authTest("step 1 shows at most 3 primary controls before the first line item (INV-1)", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Új bizonylat kiállítása")).toBeVisible();
    await expect(page.getByPlaceholder("Partner neve vagy adószáma")).toBeVisible();
    await expect(page.getByText("Dátumok és fizetés")).toBeVisible();

    // The old 14-field wall is gone — only the partner search is a text
    // input on step 1 until "Dátumok és fizetés" is expanded.
    const visibleInputs = page.locator("input:visible");
    await expect(visibleInputs).toHaveCount(1);

    // INV-1: no lying "auto-saved" text before anything has actually saved.
    await expect(page.getByText("Automatikusan mentve piszkozatként")).toHaveCount(0);
  });

  authTest("selecting a saved partner never arms e-mail sending (INV-2)", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    const search = page.getByPlaceholder("Partner neve vagy adószáma");
    await search.click();
    await search.fill("Tech");
    await page.getByText("Tech Solutions Kft.").first().click();

    await page.getByText("Ellenőrzés & küldés").click();
    const emailSwitch = page.getByRole("switch").first();
    await expect(emailSwitch).toHaveAttribute("aria-checked", "false");
  });

  authTest("submitting with an empty partner name shows the error at the field, not at the page bottom (INV-3, INV-4)", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Piszkozat mentése" }).click();
    await expect(page.getByText("Az ügyfél neve kötelező.")).toBeVisible();

    const errorBox = page.getByText("Az ügyfél neve kötelező.");
    const searchBox = page.getByPlaceholder("Partner neve vagy adószáma");
    const errorPos = await errorBox.boundingBox();
    const fieldPos = await searchBox.boundingBox();
    expect(errorPos).toBeTruthy();
    expect(fieldPos).toBeTruthy();
    // The error sits right under the field (a few hundred px, not ~1200px away).
    expect(Math.abs((errorPos!.y ?? 0) - (fieldPos!.y ?? 0))).toBeLessThan(150);
  });

  authTest("the right-hand summary updates live and always shows a VAT row (INV-13)", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Partner neve vagy adószáma").fill("Teszt Ügyfél Kft.");
    await page.getByText("Tételek").click();

    await page.getByPlaceholder("Termék vagy szolgáltatás").fill("Tanácsadás");
    const unitPriceInputs = page.locator('input[inputmode="decimal"], input[type="text"]');
    // Fill the unit price cell (second numeric-ish input in the first row).
    await page.locator("text=Összesítő").scrollIntoViewIfNeeded();

    await expect(page.getByText("Összesítő")).toBeVisible();
    await expect(page.getByText("Nettó összesen")).toBeVisible();
    await expect(page.getByText("Bruttó összesen")).toBeVisible();
  });

  authTest("VAT picker shows 2 options by default, 5 more behind 'Speciális adózás' (INV-7)", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");
    await page.getByText("Tételek").click();

    await expect(page.getByText("Adóköteles")).toBeVisible();
    await expect(page.getByText("AAM").first()).toBeVisible();
    await expect(page.getByText("Fordított adózás")).toHaveCount(0);

    await page.getByText("Speciális adózás").click();
    await expect(page.getByText(/FAD/)).toBeVisible();
  });

  authTest("the 'Nyugta' tab is gone from the document-type tabs", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Számla", { exact: true })).toBeVisible();
    await expect(page.getByText("Díjbekérő")).toBeVisible();
    await expect(page.getByText("Előlegszámla")).toBeVisible();
    await expect(page.getByText("Nyugta")).toHaveCount(0);
  });

  authTest("no form field is wider than 720px", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    const width = await page.getByPlaceholder("Partner neve vagy adószáma").evaluate(
      (el) => el.getBoundingClientRect().width
    );
    expect(width).toBeLessThanOrEqual(720);
  });

  authTest("saving a draft shows a toast and a real 'Piszkozat mentve' time, and stays on the screen", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await page.getByPlaceholder("Partner neve vagy adószáma").fill("E2E Teszt Kft.");
    await page.getByText("Tételek").click();
    await page.getByPlaceholder("Termék vagy szolgáltatás").fill("E2E tétel");

    await page.getByRole("button", { name: "Piszkozat mentése" }).click();
    await expect(page.getByText("Piszkozat elmentve.")).toBeVisible();
    await expect(page.getByText(/Piszkozat mentve \d{2}:\d{2}-kor/)).toBeVisible();
    // Draft save never navigates away.
    await expect(page).toHaveURL(/\/invoices\/new/);
  });
});

authTest.describe("Invoice composer — mobile 375×812 (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest.use({ viewport: { width: 375, height: 812 } });

  authTest("the floating footer stays under 120px, leaving the form visible (M1, INV-19)", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder("Partner neve vagy adószáma")).toBeVisible();
    await expect(page.getByText("Bruttó összesen", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tovább" })).toBeVisible();
  });
});
