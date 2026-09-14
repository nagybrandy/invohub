// __tests__/fixtures/invoices.ts
// Shared invoice fixtures for unit and component tests.
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";

export function makeLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: "line-1",
    description: "Consulting",
    quantity: 2,
    unitPrice: 100,
    vatRate: 27,
    vatCategory: "normal",
    ...overrides,
  };
}

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    invoiceNumber: "INV-2026-001",
    documentType: "invoice",
    clientName: "Acme Kft.",
    clientTaxNumber: "12345678-1-23",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    status: "sent",
    currency: "EUR",
    lineItems: [makeLineItem()],
    notes: "Thank you",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}
