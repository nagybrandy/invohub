// lib/invoices/pdf-template/sample-invoice.ts
// Sample invoice used for PDF template preview in settings.
import type { Invoice } from "@/lib/invoices/types";

export function buildSamplePreviewInvoice(): Invoice {
  const now = new Date().toISOString();
  return {
    id: "sample-preview",
    invoiceNumber: "INV-PREVIEW-001",
    clientName: "Sample Client Kft.",
    clientTaxNumber: "12345678-1-23",
    issueDate: now.slice(0, 10),
    dueDate: now.slice(0, 10),
    status: "sent",
    currency: "EUR",
    lineItems: [
      {
        id: "line-1",
        description: "Consulting services",
        quantity: 8,
        unitPrice: 95,
        vatRate: 27,
      },
      {
        id: "line-2",
        description: "Project management",
        quantity: 1,
        unitPrice: 450,
        vatRate: 27,
      },
    ],
    notes: "This is a sample invoice for PDF layout preview.",
    createdAt: now,
    updatedAt: now,
  };
}
