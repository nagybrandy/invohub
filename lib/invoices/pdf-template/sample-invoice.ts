// lib/invoices/pdf-template/sample-invoice.ts
// Sample invoice used for PDF template preview in settings.
import type { Invoice } from "@/lib/invoices/types";

export function buildSamplePreviewInvoice(): Invoice {
  const now = new Date().toISOString();
  return {
    id: "sample-preview",
    invoiceNumber: "SZLA-PREVIEW-001",
    documentType: "invoice",
    clientName: "Minta Ügyfél Kft.",
    clientTaxNumber: "12345678-1-23",
    issueDate: now.slice(0, 10),
    dueDate: now.slice(0, 10),
    status: "sent",
    currency: "HUF",
    lineItems: [
      {
        id: "line-1",
        description: "Tanácsadás",
        quantity: 8,
        unitPrice: 25000,
        vatRate: 27,
        vatCategory: "normal",
      },
      {
        id: "line-2",
        description: "Projektmenedzsment",
        quantity: 1,
        unitPrice: 120000,
        vatRate: 27,
        vatCategory: "normal",
      },
    ],
    notes: "Ez egy minta számla a PDF elrendezés előnézetéhez.",
    createdAt: now,
    updatedAt: now,
  };
}
