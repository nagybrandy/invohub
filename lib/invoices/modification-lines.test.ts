// lib/invoices/modification-lines.test.ts
import {
  buildModificationDraftLineItems,
  buildReversingLine,
} from "@/lib/invoices/modification-lines";
import { calculateInvoiceTotals, vatSummaryByRate } from "@/lib/invoices/calculations";
import { makeLineItem } from "@/__tests__/fixtures/invoices";

describe("buildReversingLine", () => {
  it("negates the quantity and keeps description, unit, unit price and VAT", () => {
    const original = makeLineItem({
      id: "li-1",
      description: "Tanácsadás",
      quantity: 3,
      unit: "óra",
      unitPrice: 15000,
      vatRate: 27,
      vatCategory: "normal",
    });
    const reversal = buildReversingLine(original);
    expect(reversal).toMatchObject({
      description: "Tanácsadás",
      quantity: -3,
      unit: "óra",
      unitPrice: 15000,
      vatRate: 27,
      vatCategory: "normal",
    });
    expect(reversal.id).not.toBe("li-1");
  });

  it("keeps an exemption (AAM) category and reason on the reversal", () => {
    const reversal = buildReversingLine(
      makeLineItem({ vatCategory: "AAM", vatRate: 0, vatExemptionReason: "Alanyi adómentes" })
    );
    expect(reversal.vatCategory).toBe("AAM");
    expect(reversal.vatExemptionReason).toBe("Alanyi adómentes");
  });

  it("never produces -0 for a zero quantity", () => {
    expect(Object.is(buildReversingLine(makeLineItem({ quantity: 0 })).quantity, 0)).toBe(true);
  });
});

describe("buildModificationDraftLineItems", () => {
  const source = [
    makeLineItem({ id: "a", description: "Tanácsadás", quantity: 3, unitPrice: 15000, vatRate: 27, unit: "óra" }),
    makeLineItem({ id: "b", description: "Könyv", quantity: 1, unitPrice: 4990, vatRate: 5, unit: "db" }),
  ];

  it("emits [reversal, copy] per original line, in the original order", () => {
    const lines = buildModificationDraftLineItems(source);
    expect(lines.map((l) => [l.description, l.quantity])).toEqual([
      ["Tanácsadás", -3],
      ["Tanácsadás", 3],
      ["Könyv", -1],
      ["Könyv", 1],
    ]);
  });

  it("gives every line a fresh, unique id (never reuses the original's)", () => {
    const ids = buildModificationDraftLineItems(source).map((l) => l.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).not.toContain("a");
    expect(ids).not.toContain("b");
  });

  it("nets to exactly zero — totals and every VAT-rate group", () => {
    const lines = buildModificationDraftLineItems(source);
    expect(calculateInvoiceTotals(lines)).toEqual({ subtotal: 0, vatTotal: 0, totalAmount: 0 });
    for (const row of vatSummaryByRate(lines)) {
      expect(row.net).toBe(0);
      expect(row.vat).toBe(0);
    }
  });

  it("leaves exactly the difference once the copy is edited to the corrected value", () => {
    const lines = buildModificationDraftLineItems([source[0]]);
    lines[1] = { ...lines[1], quantity: 4 }; // corrected: 4 hours instead of 3
    expect(calculateInvoiceTotals(lines).subtotal).toBe(15000);
  });

  it("returns an empty list for an original with no lines", () => {
    expect(buildModificationDraftLineItems([])).toEqual([]);
  });
});
