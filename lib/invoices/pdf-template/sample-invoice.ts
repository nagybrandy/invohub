// lib/invoices/pdf-template/sample-invoice.ts
// Sample invoice used for the PDF template preview in settings. Mirrors the
// data of Dóri's 2026-11 mock (buyer with an address, three lines with units,
// a bank transfer) so the preview reads like the design.
import type { Invoice } from "@/lib/invoices/types";

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildSamplePreviewInvoice(): Invoice {
  const now = new Date().toISOString();
  const issueDate = now.slice(0, 10);
  return {
    id: "sample-preview",
    invoiceNumber: "SZLA-PREVIEW-001",
    documentType: "invoice",
    clientName: "Tech Solutions Kft.",
    clientTaxNumber: "12345678-2-41",
    clientZipCode: "1117",
    clientCity: "Budapest",
    clientAddress: "Minta utca 12.",
    clientCountry: "Magyarország",
    issueDate,
    fulfillmentDate: issueDate,
    dueDate: addDays(issueDate, 8),
    paymentMethod: "transfer",
    status: "sent",
    currency: "HUF",
    lineItems: [
      {
        id: "line-1",
        description: "Webfejlesztés (óradíj)",
        quantity: 24,
        unit: "óra",
        unitPrice: 15000,
        vatRate: 27,
        vatCategory: "normal",
      },
      {
        id: "line-2",
        description: "Havi karbantartás",
        quantity: 1,
        unit: "hó",
        unitPrice: 45000,
        vatRate: 27,
        vatCategory: "normal",
      },
      {
        id: "line-3",
        description: "Hosting (éves)",
        quantity: 1,
        unit: "db",
        unitPrice: 36000,
        vatRate: 27,
        vatCategory: "normal",
      },
    ],
    notes: "Fizetési határidő 15 nap, átutalással.",
    createdAt: now,
    updatedAt: now,
  };
}
