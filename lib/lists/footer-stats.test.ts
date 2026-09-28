// lib/lists/footer-stats.test.ts
import { summarizeInvoices, summarizeReceipts } from "@/lib/lists/footer-stats";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

describe("summarizeInvoices", () => {
  it("counts rows and sums net/VAT/gross per currency, HUF first, never across currencies", () => {
    const s = summarizeInvoices([
      makeInvoice({ currency: "EUR", lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 })] }),
      makeInvoice({ currency: "HUF", lineItems: [makeLineItem({ quantity: 2, unitPrice: 1000, vatRate: 27 })] }),
      makeInvoice({ currency: "HUF", lineItems: [makeLineItem({ quantity: 1, unitPrice: 500, vatRate: 27 })] }),
    ]);
    expect(s.count).toBe(3);
    expect(s.byCurrency.map((c) => c.currency)).toEqual(["HUF", "EUR"]);
    expect(s.byCurrency[0]).toEqual({ currency: "HUF", net: 2500, vat: 675, gross: 3175 });
    expect(s.byCurrency[1]).toEqual({ currency: "EUR", net: 100, vat: 27, gross: 127 });
  });

  it("is empty for an empty list", () => {
    expect(summarizeInvoices([])).toEqual({ count: 0, byCurrency: [] });
  });
});

describe("summarizeReceipts", () => {
  it("sums gross per currency", () => {
    const s = summarizeReceipts([
      { currency: "HUF", totalAmount: 1200 },
      { currency: "HUF", totalAmount: 800 },
      { currency: "EUR", totalAmount: 10 },
    ]);
    expect(s.count).toBe(3);
    expect(s.byCurrency).toEqual([
      { currency: "HUF", net: 0, vat: 0, gross: 2000 },
      { currency: "EUR", net: 0, vat: 0, gross: 10 },
    ]);
  });
});
