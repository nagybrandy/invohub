// lib/invoices/draft-preview.test.ts
import { parseDraftPreviewInvoice, DRAFT_PREVIEW_MAX_LINE_ITEMS } from "@/lib/invoices/draft-preview";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

describe("parseDraftPreviewInvoice", () => {
  it("accepts a composer payload and always renders it as an unnumbered draft", () => {
    const result = parseDraftPreviewInvoice({
      invoice: makeInvoice({ invoiceNumber: "INV-2026-999", status: "paid", documentType: "advance" }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Never a real-looking number or status: the PDF prints "Piszkozat".
    expect(result.invoice.invoiceNumber).toBe("");
    expect(result.invoice.status).toBe("draft");
    expect(result.invoice.documentType).toBe("advance");
    expect(result.invoice.lineItems).toHaveLength(1);
  });

  it("allows an empty line-item list so the header and parties preview before any line exists", () => {
    const result = parseDraftPreviewInvoice({ invoice: makeInvoice({ lineItems: [] }) });
    expect(result.ok).toBe(true);
  });

  it.each([
    ["no body", undefined],
    ["no invoice", {}],
    ["invoice is a string", { invoice: "x" }],
    ["lineItems not an array", { invoice: { ...makeInvoice(), lineItems: "nope" } }],
  ])("rejects %s", (_label, body) => {
    expect(parseDraftPreviewInvoice(body).ok).toBe(false);
  });

  it("rejects more than the line-item cap", () => {
    const lineItems = Array.from({ length: DRAFT_PREVIEW_MAX_LINE_ITEMS + 1 }, (_, i) =>
      makeLineItem({ id: `l${i}` })
    );
    expect(parseDraftPreviewInvoice({ invoice: makeInvoice({ lineItems }) }).ok).toBe(false);
  });

  it("coerces unknown enums and non-finite numbers to safe values instead of throwing in pdfkit", () => {
    const result = parseDraftPreviewInvoice({
      invoice: {
        ...makeInvoice(),
        documentType: "bogus",
        currency: "XXX",
        paymentMethod: "barter",
        exchangeRate: "abc",
        lineItems: [
          { id: 7, description: 42, quantity: "2", unitPrice: null, vatRate: 99, vatCategory: "weird" },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.documentType).toBe("invoice");
    expect(result.invoice.currency).toBe("HUF");
    expect(result.invoice.paymentMethod).toBeUndefined();
    expect(result.invoice.exchangeRate).toBeUndefined();
    const [line] = result.invoice.lineItems;
    expect(line).toMatchObject({ id: "7", description: "42", quantity: 2, unitPrice: 0, vatRate: 27, vatCategory: "normal" });
  });

  it("keeps EUR with its exchange rate, the partner link and the notes", () => {
    const result = parseDraftPreviewInvoice({
      invoice: makeInvoice({ currency: "EUR", exchangeRate: 395.12, clientId: "c-1", notes: "Köszönjük" }),
    });
    expect(result.ok && result.invoice).toMatchObject({
      currency: "EUR",
      exchangeRate: 395.12,
      clientId: "c-1",
      notes: "Köszönjük",
    });
  });

  it("clips over-long text fields", () => {
    const result = parseDraftPreviewInvoice({
      invoice: makeInvoice({ clientName: "x".repeat(5000), notes: "n".repeat(50_000) }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.clientName.length).toBeLessThanOrEqual(500);
    expect((result.invoice.notes ?? "").length).toBeLessThanOrEqual(10_000);
  });

  it("keeps the buyer address snapshot so the live preview matches the final PDF", () => {
    const result = parseDraftPreviewInvoice({
      invoice: {
        clientName: "Duna Kft.",
        clientZipCode: "1051",
        clientCity: "Budapest",
        clientAddress: "Október 6. utca 12.",
        clientCountry: "Magyarország",
        clientEuVatNumber: "HU24681357",
        lineItems: [],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice).toMatchObject({
      clientZipCode: "1051",
      clientCity: "Budapest",
      clientAddress: "Október 6. utca 12.",
      clientCountry: "Magyarország",
      clientEuVatNumber: "HU24681357",
    });
  });
});
