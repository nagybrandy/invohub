// lib/invoices/list-actions.test.ts
import { canDeleteFromList } from "@/lib/invoices/list-actions";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("canDeleteFromList — the list offers Törlés only where the server will say yes", () => {
  it("allows a draft", () => {
    expect(canDeleteFromList(makeInvoice({ status: "draft", invoiceNumber: "" }))).toBe(true);
  });

  it("refuses every finalized state — a numbered document is cancelled with a sztornó, never removed", () => {
    for (const status of ["proforma", "sent", "unpaid", "paid", "partially_paid", "overdue", "cancelled"] as const) {
      expect(canDeleteFromList(makeInvoice({ status }))).toBe(false);
    }
  });
});
