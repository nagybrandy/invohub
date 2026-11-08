// e2e/web/invoice-preview-pdf.spec.ts
// Authenticated create -> preview -> PDF flow (Phase 1 launch gate).
//
// SAFETY: this spec may run against a database that holds real data. It only
// ever creates a DRAFT (piszkozat) and renders its preview/PDF. It never
// issues (Kiállítás), sends, marks paid, storno-s, deletes or submits to NAV.
// Every draft carries an "E2E" marker plus a timestamp in the partner name and
// the line description so it can be found (and cleaned up by hand) later.
import { expect, test as authTest, hasE2ECredentials } from "./fixtures/auth";

authTest.describe("Create -> preview -> PDF of a draft (authenticated)", () => {
  authTest.skip(
    !hasE2ECredentials,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
  );
  authTest.describe.configure({ timeout: 180_000 });
  authTest.use({ viewport: { width: 1440, height: 900 } });

  authTest("a draft can be created, previewed as a PDF and fetched as a PDF", async ({ page }) => {
    const marker = `E2E ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    const partner = `${marker} Kft.`;

    await page.goto("/invoices/new");
    const search = page.getByTestId("composer-partner-search");
    await expect(search).toBeVisible({ timeout: 60_000 });

    // Partner: type a fresh name and take the "+ Új partner" row.
    await search.fill(partner);
    // Keyboard, not a click: on desktop the "+ Új partner" row sits under the
    // partner-details card (the card intercepts pointer events), see TESTING.md.
    await expect(page.getByTestId("composer-partner-new")).toBeVisible();
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page.getByTestId("composer-partner-details")).toBeVisible();

    // One line: description + net unit price (27% VAT is the default).
    await page.getByTestId("lineItem-0-description").fill(`${marker} tétel`);
    await page.getByTestId("lineItem-0-unitPrice").fill("10000");

    // The preview renders the unsaved form through the preview endpoint.
    const previewResponse = page.waitForResponse(
      (r) => r.url().includes("/api/invoices/preview/pdf") && r.request().method() === "POST",
      { timeout: 60_000 }
    );
    await page.getByTestId("composer-open-preview").click();
    const preview = await previewResponse;
    expect(preview.status()).toBe(200);
    expect(preview.headers()["content-type"]).toContain("application/pdf");
    await expect(page.getByTestId("composer-live-preview")).toBeVisible();
    await expect(page.getByTestId("invoice-pdf-preview-frame")).toBeVisible({ timeout: 30_000 });
    // (The iframe consumes the preview body, so the bytes are checked on the
    // stored draft's PDF below.)

    // Save as a draft (never "Kiállítás") and read the new id from the API reply.
    const saved = page.waitForResponse(
      (r) =>
        /\/api\/invoices(\?|$)/.test(r.url()) && r.request().method() === "POST" && r.status() < 300,
      { timeout: 60_000 }
    );
    await page.getByTestId("composer-save-draft").click();
    const body = (await (await saved).json()) as { invoice: { id: string; status: string } };
    expect(body.invoice.status).toBe("draft");

    // The stored draft's own PDF endpoint answers with a real PDF too.
    const pdf = await page.request.get(`/api/invoices/${body.invoice.id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    const pdfBytes = await pdf.body();
    expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfBytes.length).toBeGreaterThan(5_000);
  });
});
