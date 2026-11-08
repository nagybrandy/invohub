// lib/clients/partner-prefill.test.ts
import {
  appendPreviousItems,
  applyVatToPristineLines,
  usualToComposerPatch,
} from "@/lib/clients/partner-prefill";
import type { InvoiceLineItem } from "@/lib/invoices/types";

const blank = (id = "b"): InvoiceLineItem => ({
  id, description: "", quantity: 1, unitPrice: 0, vatRate: 27, vatCategory: "normal", unit: "db",
});
const filled = (id = "f"): InvoiceLineItem => ({ ...blank(id), description: "Munka", unitPrice: 100 });

describe("usualToComposerPatch", () => {
  it("maps every known setting", () => {
    expect(
      usualToComposerPatch({
        currency: "EUR", language: "en", paymentMethod: "cash", paymentTermDays: 15,
        vat: { rate: 0, category: "AAM" }, lineItems: [],
      })
    ).toEqual({
      currency: "EUR", language: "en", paymentMethod: "cash", deadlineDays: 15,
      vat: { rate: 0, category: "AAM" },
    });
  });
  it("leaves out what is unknown and never carries dates", () => {
    const patch = usualToComposerPatch({ lineItems: [] });
    expect(patch).toEqual({});
    expect(Object.keys(usualToComposerPatch({ currency: "HUF", lineItems: [] }))).not.toContain("dueDate");
  });
});

describe("applyVatToPristineLines", () => {
  it("changes only untouched starter lines", () => {
    const out = applyVatToPristineLines([blank("a"), filled("b")], { rate: 0, category: "AAM" });
    expect(out[0]).toMatchObject({ vatRate: 0, vatCategory: "AAM" });
    expect(out[1]).toMatchObject({ vatRate: 27, vatCategory: "normal" });
  });
});

describe("appendPreviousItems", () => {
  const prev = [
    { description: "Fejlesztés", quantity: 3, unit: "óra", unitPrice: 9000, vatRate: 27 as const, vatCategory: "normal" as const },
  ];
  let n = 0;
  const id = () => `new-${++n}`;
  it("replaces the empty starter line", () => {
    const out = appendPreviousItems([blank()], prev, id);
    expect(out).toEqual([
      { id: "new-1", description: "Fejlesztés", quantity: 3, unit: "óra", unitPrice: 9000, vatRate: 27, vatCategory: "normal" },
    ]);
  });
  it("appends after real lines, dropping only empty ones", () => {
    const out = appendPreviousItems([filled("f"), blank("b")], prev, id);
    expect(out.map((l) => l.description)).toEqual(["Munka", "Fejlesztés"]);
  });
  it("defaults the unit", () => {
    const out = appendPreviousItems([blank()], [{ ...prev[0], unit: undefined }], id);
    expect(out[0].unit).toBe("db");
  });
});
