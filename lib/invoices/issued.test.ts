// lib/invoices/issued.test.ts
import { isIssuedDocument } from "@/lib/invoices/issued";

describe("isIssuedDocument — the one definition of 'kiállított'", () => {
  it("counts a finalized invoice whatever its payment state", () => {
    for (const status of ["unpaid", "sent", "overdue", "partially_paid", "paid"] as const) {
      expect(isIssuedDocument({ status, documentType: "invoice" })).toBe(true);
    }
  });

  it("never counts a draft — it is not issued yet", () => {
    expect(isIssuedDocument({ status: "draft", documentType: "invoice" })).toBe(false);
  });

  it("never counts a díjbekérő — it is not a tax document, by status or by type", () => {
    expect(isIssuedDocument({ status: "proforma", documentType: "proforma" })).toBe(false);
    expect(isIssuedDocument({ status: "unpaid", documentType: "proforma" })).toBe(false);
  });

  it("still counts a cancelled original — its storno carries the offsetting lines", () => {
    expect(isIssuedDocument({ status: "cancelled", documentType: "invoice" })).toBe(true);
    expect(isIssuedDocument({ status: "sent", documentType: "storno" })).toBe(true);
    expect(isIssuedDocument({ status: "sent", documentType: "modify" })).toBe(true);
  });
});
