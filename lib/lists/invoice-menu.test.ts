import { canMarkPaidFromList, invoiceMenuActions, MAX_INVOICE_MENU_ACTIONS } from "@/lib/lists/invoice-menu";

describe("invoiceMenuActions", () => {
  it("offers open, PDF, duplicate and mark paid for a sent invoice", () => {
    expect(invoiceMenuActions({ status: "sent", documentType: "invoice" })).toEqual([
      "open",
      "pdf",
      "duplicate",
      "markPaid",
    ]);
  });

  it("offers delete only for drafts, last, and never mark paid", () => {
    expect(invoiceMenuActions({ status: "draft", documentType: "invoice" })).toEqual([
      "open",
      "pdf",
      "duplicate",
      "delete",
    ]);
    expect(invoiceMenuActions({ status: "sent", documentType: "invoice" })).not.toContain("delete");
    expect(invoiceMenuActions({ status: "paid", documentType: "invoice" })).not.toContain("delete");
  });

  it("does not offer mark paid for paid or cancelled invoices", () => {
    expect(invoiceMenuActions({ status: "paid", documentType: "invoice" })).not.toContain("markPaid");
    expect(invoiceMenuActions({ status: "cancelled", documentType: "invoice" })).not.toContain("markPaid");
    expect(canMarkPaidFromList({ status: "unpaid" })).toBe(true);
  });

  it("offers the conversion for a díjbekérő, or its existing invoice once converted", () => {
    expect(invoiceMenuActions({ status: "sent", documentType: "proforma" })).toContain("convert");
    expect(invoiceMenuActions({ status: "sent", documentType: "proforma" }, { convertedExists: true })).toContain(
      "openConverted",
    );
  });

  it("never offers send, storno or NAV actions and never exceeds five items", () => {
    const statuses = ["draft", "proforma", "sent", "paid", "partially_paid", "unpaid", "overdue", "cancelled"] as const;
    const types = ["invoice", "proforma", "advance"] as const;
    for (const status of statuses) {
      for (const documentType of types) {
        for (const convertedExists of [true, false]) {
          const actions = invoiceMenuActions({ status, documentType } as never, { convertedExists });
          expect(actions.length).toBeLessThanOrEqual(MAX_INVOICE_MENU_ACTIONS);
          for (const action of actions) {
            expect(["open", "pdf", "duplicate", "markPaid", "convert", "openConverted", "delete"]).toContain(action);
          }
        }
      }
    }
  });
});
