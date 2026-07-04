// lib/invoices/build-draft-invoice.test.ts
import {
  buildDraftInvoice,
  ensureDraftLineItems,
} from "@/lib/invoices/build-draft-invoice";
import { createEmptyLineItem } from "@/lib/invoices/calculations";

describe("buildDraftInvoice", () => {
  it("builds preview invoice from form fields", () => {
    const invoice = buildDraftInvoice({
      invoiceNumber: "INV-001",
      clientName: "Acme Kft.",
      issueDate: "2026-01-01",
      dueDate: "2026-01-15",
      currency: "EUR",
      lineItems: [
        {
          id: "1",
          description: "Consulting",
          quantity: 2,
          unitPrice: 100,
          vatRate: 27,
        },
      ],
    });

    expect(invoice.invoiceNumber).toBe("INV-001");
    expect(invoice.clientName).toBe("Acme Kft.");
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.status).toBe("draft");
  });

  it("uses placeholder client when empty", () => {
    const invoice = buildDraftInvoice({
      invoiceNumber: "",
      clientName: "",
      issueDate: "2026-01-01",
      dueDate: "2026-01-15",
      currency: "HUF",
      lineItems: [createEmptyLineItem()],
    });

    expect(invoice.clientName).toBe("—");
    expect(invoice.invoiceNumber).toBe("DRAFT");
  });
});

describe("ensureDraftLineItems", () => {
  it("returns sample line when empty", () => {
    const items = ensureDraftLineItems([]);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toBeTruthy();
  });
});
