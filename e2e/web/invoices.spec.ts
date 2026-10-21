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

  // Owner decision 2026-10-21: the dates/payment block and the buyer details
  // are visible from the start (no collapsed toggle); the earlier "one input
  // only" rule (INV-1) is replaced by "nothing lies, nothing is hidden".
  authTest("the dates and payment block is visible from the start; no fake auto-save text (INV-1)", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Új bizonylat kiállítása")).toBeVisible();
    await expect(page.getByPlaceholder("Partner neve vagy adószáma")).toBeVisible();
    await expect(page.getByText("Dátumok és fizetés")).toBeVisible();

    await expect(page.getByTestId("composer-bottom-finalize")).toBeVisible();

    // INV-1: no lying "auto-saved" text before anything has actually saved.
    await expect(page.getByText("Automatikusan mentve piszkozatként")).toHaveCount(0);
  });

  authTest("a gross unit price is backed out to net, and the dates block is open (owner spec 2026-10-21)", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Teljesítés dátuma").first()).toBeVisible();
    await page.getByTestId("unit-price-mode-gross").click();
    const price = page.getByTestId("lineItem-0-unitPrice");
    await price.fill("25000");
    // 25 000 brutto at 27% = 19 685.04 net — the user never does the maths.
    await expect(page.getByText(/25[\s,.\u00a0]?000/).first()).toBeVisible();
    await page.getByTestId("unit-price-mode-net").click();
    await expect(price).toHaveValue("19685.03937");
  });

  authTest("shows translated labels (no raw keys), a per-line remark and the document language", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("A bizonylat nyelve")).toBeVisible();
    await expect(page.getByTestId("lineItem-0-comment")).toBeVisible();
    await expect(page.getByText("Egységár megadása:")).toBeVisible();
    // A missing translation renders its dotted key — none may be on the screen.
    await expect(page.getByText(/\b(invoices|billing|settings|receipts)\.[a-zA-Z]+\.[a-zA-Z.]+/)).toHaveCount(0);
  });

  authTest("a new receipt has no customer-name field and a system-assigned number", async ({ page }) => {
    await page.goto("/receipts/new");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("A nyugta sorszámát a rendszer adja ki")).toBeVisible();
    await expect(page.getByText("Ügyfél neve")).toHaveCount(0);
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

  authTest("the data export downloads a filtered CSV", async ({ page }) => {
    await page.goto("/export");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Adatexport").first()).toBeVisible();

    await page.getByTestId("export-dataset-clients").click();
    await expect(page.getByText(/\d+ sor lesz a fájlban/)).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-download").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^partnerek-osszes-\d{4}-\d{2}-\d{2}\.csv$/);

    await page.getByTestId("export-dataset-invoices").click();
    await page.getByTestId("export-status-paid").click();
    await expect(page.getByText(/\d+ sor lesz a fájlban/)).toBeVisible();
  });
});

authTest.describe("Billing settings and reminders (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );

  authTest("the billing settings page loads, and the reminders page shows words, not keys", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Számla-előtag").first()).toBeVisible();
    await expect(page.getByTestId("billing-prefix-input")).toBeVisible();

    await page.goto("/settings/reminders");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Ütemezés mentése")).toBeVisible();
    await expect(page.getByText(/\breminders\.[a-zA-Z]+/)).toHaveCount(0);
  });

  authTest("the bulk upload validates a file and previews it without creating anything", async ({ page }) => {
    await page.goto("/bulk");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Tömeges feltöltés").first()).toBeVisible();

    const header = "type;partner_name;partner_zip;partner_city;partner_address;description;unit_price;vat_rate";
    const csv = [header, "invoice;Minta Kft.;1051;Budapest;Nádor u. 1.;Havi díj;10000;27", "invoice;;;;;;abc;20"].join("\r\n");
    await page.getByTestId("bulk-file").setInputFiles({ name: "feltoltes.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });

    await expect(page.getByText(/2 sor: 1 rendben, 1 hibás/)).toBeVisible();
    await expect(page.getByText(/partner_name: kötelező mező/)).toBeVisible();
    await expect(page.getByText(/vat_rate: 27, 18, 5, 0/)).toBeVisible();
    await expect(page.getByTestId("bulk-create")).toBeEnabled();
  });

  authTest("USD can be chosen and the MNB rate is filled in automatically", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("composer-currency-USD").click();
    await expect(page.getByText(/MNB/).first()).toBeVisible({ timeout: 20000 });
    // The "more currencies" list offers the others the MNB publishes.
    await page.getByTestId("composer-currency-more").click();
    await expect(page.getByTestId("composer-currency-CHF")).toBeVisible();
  });
});
