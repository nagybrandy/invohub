import { canSaveAsRecurring } from "@/lib/recurring/eligibility";
import type { InvoiceDocumentType, InvoiceStatus } from "@/lib/invoices/types";

describe("canSaveAsRecurring", () => {
  it.each<InvoiceStatus>(["draft", "sent", "unpaid", "overdue", "partially_paid", "paid"])(
    "allows a regular invoice that is %s",
    (status) => {
      expect(canSaveAsRecurring({ documentType: "invoice", status })).toBe(true);
    }
  );
  it("rejects a cancelled invoice", () => {
    expect(canSaveAsRecurring({ documentType: "invoice", status: "cancelled" })).toBe(false);
  });
  it.each<InvoiceDocumentType>(["proforma", "storno", "modify", "advance"])("rejects %s documents", (documentType) => {
    expect(canSaveAsRecurring({ documentType, status: "sent" })).toBe(false);
    expect(canSaveAsRecurring({ documentType, status: "draft" })).toBe(false);
  });
});
