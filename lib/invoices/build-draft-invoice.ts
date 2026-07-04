// lib/invoices/build-draft-invoice.ts
// Builds an in-memory invoice from new-invoice form fields for preview.
import { createId } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceCurrency, InvoiceStatus } from "@/lib/invoices/types";

export type DraftInvoiceInput = {
  invoiceNumber: string;
  clientName: string;
  clientTaxNumber?: string;
  issueDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  notes?: string;
  lineItems: Invoice["lineItems"];
  status?: InvoiceStatus;
};

export function buildDraftInvoice(input: DraftInvoiceInput): Invoice {
  const now = new Date().toISOString();
  return {
    id: "draft-preview",
    invoiceNumber: input.invoiceNumber.trim() || "DRAFT",
    clientName: input.clientName.trim() || "—",
    clientTaxNumber: input.clientTaxNumber?.trim() || undefined,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    status: input.status ?? "draft",
    currency: input.currency,
    lineItems: input.lineItems.filter((item) => item.description.trim()),
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function ensureDraftLineItems(lineItems: Invoice["lineItems"]): Invoice["lineItems"] {
  if (lineItems.length > 0) return lineItems;
  return [
    {
      id: createId(),
      description: "Sample line item",
      quantity: 1,
      unitPrice: 0,
      vatRate: 27,
    },
  ];
}
