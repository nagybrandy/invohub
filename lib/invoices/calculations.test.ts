// lib/invoices/calculations.test.ts
import {
  calculateInvoiceTotals,
  createEmptyLineItem,
  formatCurrency,
  isCurrentMonth,
  lineItemGrossTotal,
  lineItemNetTotal,
  lineItemVatAmount,
  vatSummaryByRate,
} from "@/lib/invoices/calculations";
import { makeLineItem } from "@/__tests__/fixtures/invoices";

describe("lineItemNetTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineItemNetTotal(makeLineItem({ quantity: 3, unitPrice: 50 }))).toBe(150);
  });
});

describe("lineItemVatAmount", () => {
  it("applies VAT rate to net total", () => {
    expect(lineItemVatAmount(makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 }))).toBe(27);
  });

  it("handles 0% VAT", () => {
    expect(lineItemVatAmount(makeLineItem({ vatRate: 0 }))).toBe(0);
  });

  it("forces 0 for an exempt category even if vatRate wasn't zeroed", () => {
    expect(
      lineItemVatAmount(makeLineItem({ vatRate: 27, vatCategory: "AAM" }))
    ).toBe(0);
    expect(
      lineItemVatAmount(makeLineItem({ vatRate: 27, vatCategory: "FAD" }))
    ).toBe(0);
  });
});

describe("lineItemGrossTotal", () => {
  it("sums net and VAT", () => {
    expect(lineItemGrossTotal(makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 }))).toBe(127);
  });
});

describe("calculateInvoiceTotals", () => {
  it("aggregates multiple line items", () => {
    const totals = calculateInvoiceTotals([
      makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 }),
      makeLineItem({ id: "line-2", quantity: 2, unitPrice: 50, vatRate: 5 }),
    ]);
    expect(totals.subtotal).toBe(200);
    expect(totals.vatTotal).toBe(32);
    expect(totals.totalAmount).toBe(232);
  });

  it("returns zeros for empty list", () => {
    expect(calculateInvoiceTotals([])).toEqual({
      subtotal: 0,
      vatTotal: 0,
      totalAmount: 0,
    });
  });
});

describe("formatCurrency", () => {
  it("formats EUR with symbol prefix", () => {
    expect(formatCurrency(1234.5, "EUR")).toMatch(/^€/);
    expect(formatCurrency(1234.5, "EUR")).toContain("1,234.50");
  });

  it("formats HUF with symbol suffix", () => {
    expect(formatCurrency(45000, "HUF")).toMatch(/Ft$/);
  });
});

describe("createEmptyLineItem", () => {
  it("returns defaults", () => {
    const item = createEmptyLineItem();
    expect(item.description).toBe("");
    expect(item.quantity).toBe(1);
    expect(item.unitPrice).toBe(0);
    expect(item.vatRate).toBe(27);
    expect(item.vatCategory).toBe("normal");
    expect(item.id).toBeTruthy();
  });

  it("defaults to AAM/0% when the company is VAT-exempt", () => {
    const item = createEmptyLineItem({ vatExempt: true });
    expect(item.vatCategory).toBe("AAM");
    expect(item.vatRate).toBe(0);
  });
});

describe("isCurrentMonth", () => {
  it("returns true for today", () => {
    expect(isCurrentMonth(new Date().toISOString().slice(0, 10))).toBe(true);
  });

  it("returns false for last year", () => {
    expect(isCurrentMonth("2020-01-15")).toBe(false);
  });
});

describe("vatSummaryByRate", () => {
  it("groups taxed lines by rate, highest rate first, with net/vat/gross per group", () => {
    const rows = vatSummaryByRate([
      makeLineItem({ id: "a", quantity: 2, unitPrice: 1000, vatRate: 27 }),
      makeLineItem({ id: "b", quantity: 1, unitPrice: 500, vatRate: 5 }),
      makeLineItem({ id: "c", quantity: 1, unitPrice: 3000, vatRate: 27 }),
    ]);
    expect(rows).toEqual([
      { key: "27", label: "27%", net: 5000, vat: 1350, gross: 6350 },
      { key: "5", label: "5%", net: 500, vat: 25, gross: 525 },
    ]);
  });

  it("keeps exempt categories as their own groups with zero VAT, after the taxed rates", () => {
    const rows = vatSummaryByRate([
      makeLineItem({ id: "a", quantity: 1, unitPrice: 800, vatRate: 0, vatCategory: "AAM" }),
      makeLineItem({ id: "b", quantity: 1, unitPrice: 1000, vatRate: 27 }),
    ]);
    expect(rows).toEqual([
      { key: "27", label: "27%", net: 1000, vat: 270, gross: 1270 },
      { key: "AAM", label: "AAM", net: 800, vat: 0, gross: 800 },
    ]);
  });

  it("sums to the same totals as calculateInvoiceTotals", () => {
    const items = [
      makeLineItem({ id: "a", quantity: 3, unitPrice: 333, vatRate: 27 }),
      makeLineItem({ id: "b", quantity: 7, unitPrice: 12.5, vatRate: 18 as never }),
      makeLineItem({ id: "c", quantity: 1, unitPrice: 99, vatRate: 0, vatCategory: "TAM" }),
    ];
    const rows = vatSummaryByRate(items);
    const totals = calculateInvoiceTotals(items);
    expect(rows.reduce((s, r) => s + r.net, 0)).toBeCloseTo(totals.subtotal, 6);
    expect(rows.reduce((s, r) => s + r.vat, 0)).toBeCloseTo(totals.vatTotal, 6);
    expect(rows.reduce((s, r) => s + r.gross, 0)).toBeCloseTo(totals.totalAmount, 6);
  });

  it("returns an empty array for no lines", () => {
    expect(vatSummaryByRate([])).toEqual([]);
  });
});
