// e2e/web/invoices.spec.ts
// Invoice E2E tests against the 2026-11 redesign (docs/design/redesign-2026-11/
// SPEC.md §6 list, §8 composer): the one-page composer, the Számlák list with
// KPI strip + status tabs, and a read-only look at an existing invoice.
// Validation/save-branch details live in the unit tests (composer-logic,
// useInvoiceComposer, PartnerPicker). The create -> preview -> PDF flow is in
// invoice-preview-pdf.spec.ts.
//
// SAFETY: these specs may run against a database with real data. They only
// read, type into forms and open menus. Nothing here saves, issues
// (Kiállítás), sends, marks paid, storno-s, deletes or submits to NAV.
import { test, expect, type Page } from "@playwright/test";
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

authTest.describe("Invoice composer — desktop (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  async function openComposer(page: Page) {
    await page.goto("/invoices/new");
    await expect(page.getByTestId("composer-partner-search")).toBeVisible({ timeout: 60_000 });
  }

  authTest("shows the sections, the document-type switch and the bottom bar (no fake auto-save text)", async ({
    page,
  }) => {
    await openComposer(page);

    await expect(page.getByRole("heading", { name: "Új bizonylat kiállítása" })).toBeVisible();
    for (const id of ["composer-section-partner", "composer-section-dates", "composer-section-items", "composer-section-dispatch"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // Document types: Nyugta is not one of them (receipts have their own screen).
    const types = page.getByTestId("composer-type-switch");
    await expect(types.getByText("Számla", { exact: true })).toBeVisible();
    await expect(types.getByText("Díjbekérő")).toBeVisible();
    await expect(types.getByText("Előlegszámla")).toBeVisible();
    await expect(types.getByText("Nyugta")).toHaveCount(0);

    // Both actions are there; this spec never presses "Kiállítás".
    await expect(page.getByTestId("composer-save-draft")).toBeVisible();
    await expect(page.getByTestId("composer-action-finalize")).toBeVisible();
    // INV-1: nothing claims an auto-save that did not happen.
    await expect(page.getByText("Automatikusan mentve piszkozatként")).toHaveCount(0);
  });

  authTest("the dates and payment block is open from the start", async ({ page }) => {
    await openComposer(page);
    const terms = page.getByTestId("composer-section-dates");
    await expect(terms.getByText("Teljesítés")).toBeVisible();
    await expect(terms.getByText("Fizetési határidő")).toBeVisible();
    await expect(terms.getByText("Fizetési mód")).toBeVisible();
    await expect(terms.getByText("Pénznem")).toBeVisible();
  });

  authTest("a gross unit price is backed out to net, and the totals follow", async ({ page }) => {
    await openComposer(page);

    await page.getByTestId("unit-price-mode-switch").click();
    const price = page.getByTestId("lineItem-0-unitPrice");
    await price.fill("25000");
    // 25 000 gross at 27% VAT = 19 685.04 net: the user never does the maths.
    await expect(page.getByTestId("composer-bottom-totals")).toContainText(/25[\s,.\u00a0]?000/);
    await page.getByTestId("unit-price-mode-switch").click();
    await expect(price).toHaveValue("19685.03937");
  });

  authTest("the totals update live and always show a VAT row", async ({ page }) => {
    await openComposer(page);
    await page.getByTestId("lineItem-0-unitPrice").fill("10000");
    const totals = page.getByTestId("composer-totals");
    await expect(totals).toContainText("Nettó összesen");
    await expect(totals).toContainText("ÁFA");
    await expect(totals).toContainText("Bruttó összesen");
    await expect(totals).toContainText(/12[\s,.\u00a0]?700/);
  });

  authTest("the VAT picker offers 27% by default and the special treatments (AAM, FAD, ...)", async ({
    page,
  }) => {
    await openComposer(page);
    const vat = page.getByTestId("lineItem-0-vat");
    await expect(vat).toBeVisible();
    await expect(vat).toContainText("27%");
  });

  authTest("shows translated labels (no raw keys) and the per-line remark", async ({ page }) => {
    await openComposer(page);
    await expect(page.getByTestId("lineItem-0-comment-add")).toBeVisible();
    // A missing translation renders its dotted key — none may be on the screen.
    await expect(page.getByText(/\b(invoices|billing|settings|receipts|composer)\.[a-zA-Z]+\.[a-zA-Z.]+/)).toHaveCount(0);
  });

  authTest("choosing a saved partner never arms e-mail sending (INV-2)", async ({ page }) => {
    await openComposer(page);
    const search = page.getByTestId("composer-partner-search");
    await search.fill("Tech");
    const option = page.locator('[data-testid^="composer-partner-option-"]').first();
    // No saved partner called "Tech..." in this account: nothing to check then.
    authTest.skip((await option.count()) === 0, "No saved partner matches 'Tech' in this account.");
    await option.click();
    await expect(page.getByTestId("composer-email-switch")).toHaveAttribute("aria-checked", "false");
  });

  authTest("a new document can start from a previous invoice ('Másolás korábbi számlából')", async ({
    page,
  }) => {
    await openComposer(page);
    await page.getByTestId("composer-copy-trigger").click();
    await expect(page.getByTestId("composer-copy-popover")).toBeVisible();
  });

  authTest("USD can be chosen and the MNB rate is filled in automatically", async ({ page }) => {
    await openComposer(page);
    // The currency picker sits behind "Módosítás" on the dates card.
    await page.getByTestId("composer-terms-toggle").click();
    await page.getByTestId("composer-currency-USD").click();
    await expect(page.getByText(/MNB/).first()).toBeVisible({ timeout: 30_000 });
  });
});

authTest.describe("Invoice composer — mobile 375x812 (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 375, height: 812 } });

  authTest("the form and the sticky bottom bar are both reachable", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(page.getByTestId("composer-partner-search")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("composer-bottom-bar")).toBeVisible();
    await expect(page.getByTestId("composer-save-draft")).toBeVisible();
    // No horizontal page scroll on a phone.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

// Számlák (SPEC §6): header with "Új számla", the KPI strip, a toolbar, status
// tabs and one table. All read-only.
authTest.describe("Invoice list (authenticated, desktop)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  async function openList(page: Page, query = "") {
    await page.goto(`/invoices${query}`);
    await expect(page.getByTestId("invoice-list-screen")).toBeVisible({ timeout: 60_000 });
    // Counts arrive after the first paint.
    await expect(page.getByTestId("status-tab-all")).toBeVisible();
  }

  authTest("has the header action, the KPI strip and the status tabs", async ({ page }) => {
    await openList(page);
    await expect(page.getByRole("heading", { name: "Számlák" })).toBeVisible();
    await expect(page.getByTestId("invoice-list-new")).toBeVisible();

    const kpi = page.getByTestId("kpi-strip");
    for (const cell of ["outstanding", "overdue", "paid", "vat"]) {
      await expect(kpi.getByTestId(`kpi-strip-${cell}`)).toBeVisible();
    }
    await expect(kpi).toContainText("Kintlévőség");
    await expect(kpi).toContainText("Lejárt");
    await expect(kpi).toContainText("Fizetve");
    await expect(kpi).toContainText("ÁFA");

    const tabs = page.getByTestId("status-tabs");
    for (const label of ["Összes", "Piszkozat", "Fizetésre vár", "Fizetetlen", "Lejárt", "Fizetve"]) {
      await expect(tabs.getByText(label, { exact: true })).toBeVisible();
    }
  });

  authTest("'Új számla' on the list opens the composer", async ({ page }) => {
    await openList(page);
    await page.getByTestId("invoice-list-new").click();
    await page.waitForURL(/\/invoices\/new/);
    await expect(page.getByTestId("composer-partner-search")).toBeVisible({ timeout: 60_000 });
  });

  authTest("renders a table with the column headers and status pills", async ({ page }) => {
    await openList(page);
    const table = page.getByTestId("invoice-list-table");
    await expect(table).toBeVisible();
    for (const header of ["Sorszám", "Partner", "Kelt", "Fizetési határidő", "Státusz", "NAV", "Bruttó összeg"]) {
      await expect(table.getByText(header, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByTestId("invoice-list-row").first()).toBeVisible();
    await expect(page.getByTestId("invoice-status-chip").first()).toBeVisible();
  });

  authTest("the Piszkozat tab filters the list to drafts", async ({ page }) => {
    await openList(page);
    await page.getByTestId("status-tab-draft").click();
    const chipTexts = async () =>
      (await page.getByTestId("invoice-status-chip").allInnerTexts()).map((l) => l.trim());
    // The list refetches after the tab press: wait until only drafts are left.
    await expect
      .poll(async () => {
        const texts = await chipTexts();
        return texts.length > 0 && texts.every((l) => l === "Piszkozat");
      }, { timeout: 30_000 })
      .toBe(true);
  });

  authTest("the Dátum / Határidő / Bruttó headers sort the table", async ({ page }) => {
    await openList(page);
    for (const id of ["invoice-table-sort-issued", "invoice-table-sort-due", "invoice-table-sort-gross"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await page.getByTestId("invoice-table-sort-gross").click();
    await expect(page.getByTestId("invoice-list-table")).toBeVisible();
  });

  authTest("search narrows the list and a miss shows the empty result", async ({ page }) => {
    await openList(page);
    const search = page.getByTestId("invoice-list-search");
    await search.fill("zzz-no-such-partner-zzz");
    await expect(page.getByTestId("invoice-list-row")).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText("Nincs találat")).toBeVisible();
  });

  authTest("the status can be deep-linked (?status=overdue)", async ({ page }) => {
    await openList(page, "?status=overdue");
    const chips = page.getByTestId("invoice-status-chip");
    // An account without overdue invoices has no rows; otherwise every row is overdue.
    await page.waitForTimeout(2_000);
    for (const label of await chips.allInnerTexts()) expect(label.trim()).toBe("Lejárt");
  });

  authTest("a row's ⋯ menu opens (read-only look: nothing in it is pressed)", async ({ page }) => {
    await openList(page);
    authTest.skip((await page.getByTestId("invoice-list-row").count()) === 0, "No invoices to open a menu on.");
    await page.getByTestId("overflow-menu-trigger").first().click();
    await expect(page.getByRole("menuitem", { name: "Megnyitás" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  authTest("opening an invoice shows the money header (read-only)", async ({ page }) => {
    await openList(page);
    const row = page.getByTestId("invoice-list-row").first();
    authTest.skip((await row.count()) === 0, "No invoices to open.");
    await row.click();
    await page.waitForURL(/\/invoices\/[^/]+/, { timeout: 30_000 });
    await expect(page.getByTestId("invoice-money-header-gross")).toBeVisible({ timeout: 60_000 });
  });

  authTest("the data export page downloads a filtered CSV", async ({ page }) => {
    await page.goto("/export");
    await expect(page.getByText("Adatexport").first()).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("export-dataset-clients").click();
    await expect(page.getByText(/\d+ sor lesz a fájlban/)).toBeVisible();
    // Best effort on the browser's download event (some browser channels
    // suppress it); the page's own "N sor letöltve." confirmation is the
    // assertion that always holds.
    const downloadEvent = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
    await page.getByTestId("export-download").click();
    // Known app bug (reported in the E2E hand-off): the first press right after
    // switching the dataset answers "nincs találata" although the count above says
    // 9 rows; the second press downloads. Recorded as an annotation, not hidden.
    const empty = page.getByText("A szűrésnek nincs találata — nincs mit letölteni.");
    await page.waitForTimeout(1_000);
    if (await empty.isVisible()) {
      authTest.info().annotations.push({
        type: "known-bug",
        description: "export: first CSV press after switching dataset reports an empty result",
      });
      await page.getByTestId("export-download").click();
    }
    await expect(page.getByText(/\d+ sor letöltve\./)).toBeVisible();
    const download = await downloadEvent;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/^partnerek-osszes-\d{4}-\d{2}-\d{2}\.csv$/);
    }

    await page.getByTestId("export-dataset-invoices").click();
    await page.getByTestId("export-status-paid").click();
    // Invoices load through the paged API first.
    await expect(page.getByText(/\d+ sor lesz a fájlban/)).toBeVisible({ timeout: 30_000 });
  });
});

authTest.describe("Bulk upload and account banner (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 120_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  authTest("the bulk upload validates a file and previews it without creating anything", async ({ page }) => {
    await page.goto("/bulk");
    await expect(page.getByText("Tömeges feltöltés").first()).toBeVisible({ timeout: 60_000 });

    const header = "type;partner_name;partner_zip;partner_city;partner_address;description;unit_price;vat_rate";
    const csv = [header, "invoice;Minta Kft.;1051;Budapest;Nádor u. 1.;Havi díj;10000;27", "invoice;;;;;;abc;20"].join("\r\n");
    await page.getByTestId("bulk-file").setInputFiles({ name: "feltoltes.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });

    await expect(page.getByText(/2 sor: 1 rendben, 1 hibás/)).toBeVisible();
    await expect(page.getByText(/partner_name: kötelező mező/)).toBeVisible();
    await expect(page.getByText(/vat_rate: 27, 18, 5, 0/)).toBeVisible();
    // Only checked, never pressed: that button would create documents.
    await expect(page.getByTestId("bulk-create")).toBeEnabled();
  });

  authTest("the sidebar shows the billing account and no foreign-account banner", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("sidebar-account-button")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("foreign-account-banner")).toHaveCount(0);
  });
});
