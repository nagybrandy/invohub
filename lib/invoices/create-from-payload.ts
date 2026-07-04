// lib/invoices/create-from-payload.ts
// Validates and builds an Invoice from API / external payloads.
import { createEmptyLineItem, generateInvoiceNumber } from "@/lib/invoices/calculations";
import { INVOICE_LIST_MAX_LIMIT } from "@/lib/invoices/constants";
import { listInvoices, upsertInvoice } from "@/lib/invoices/service";
import type {
  Invoice,
  InvoiceCurrency,
  InvoiceLineItem,
  InvoiceStatus,
  VatRate,
} from "@/lib/invoices/types";
import { createId } from "@/lib/id";

const VAT_RATES: VatRate[] = [0, 5, 27];
const STATUSES: InvoiceStatus[] = [
  "draft",
  "proforma",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

export type ExternalLineItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate?: VatRate;
};

export type ExternalInvoiceInput = {
  invoiceNumber?: string;
  clientName: string;
  clientTaxNumber?: string;
  issueDate?: string;
  dueDate?: string;
  status?: InvoiceStatus;
  currency?: InvoiceCurrency;
  lineItems: ExternalLineItemInput[];
  notes?: string;
  submitToNav?: boolean;
  /** Send invoice email immediately after creation (default true). */
  sendEmail?: boolean;
  /** Override recipient; falls back to company default or client email. */
  emailTo?: string;
};

export function validateExternalInvoiceInput(
  body: Partial<ExternalInvoiceInput>
): string | null {
  if (!body.clientName?.trim()) {
    return "clientName is required.";
  }
  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    return "At least one lineItems entry is required.";
  }
  for (const [index, item] of body.lineItems.entries()) {
    if (!item.description?.trim()) {
      return `lineItems[${index}].description is required.`;
    }
    if (typeof item.quantity !== "number" || Number.isNaN(item.quantity)) {
      return `lineItems[${index}].quantity must be a number.`;
    }
    if (typeof item.unitPrice !== "number" || Number.isNaN(item.unitPrice)) {
      return `lineItems[${index}].unitPrice must be a number.`;
    }
    if (item.vatRate !== undefined && !VAT_RATES.includes(item.vatRate)) {
      return `lineItems[${index}].vatRate must be one of ${VAT_RATES.join(", ")}.`;
    }
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return `status must be one of ${STATUSES.join(", ")}.`;
  }
  if (body.currency && body.currency !== "EUR" && body.currency !== "HUF") {
    return "currency must be EUR or HUF.";
  }
  return null;
}

function mapLineItems(items: ExternalLineItemInput[]): InvoiceLineItem[] {
  return items.map((item) => ({
    id: createId(),
    description: item.description.trim(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate ?? 27,
  }));
}

export async function createInvoiceFromPayload(
  userId: string,
  body: ExternalInvoiceInput
): Promise<Invoice> {
  const validationError = validateExternalInvoiceInput(body);
  if (validationError) {
    throw new Error(validationError);
  }

  const now = new Date().toISOString();
  const { invoices: existing } = await listInvoices(userId, {
    limit: INVOICE_LIST_MAX_LIMIT,
  });
  const invoice: Invoice = {
    id: createId(),
    invoiceNumber:
      body.invoiceNumber?.trim() ||
      generateInvoiceNumber(existing),
    clientName: body.clientName.trim(),
    clientTaxNumber: body.clientTaxNumber?.trim(),
    issueDate: body.issueDate ?? now.slice(0, 10),
    dueDate: body.dueDate ?? body.issueDate ?? now.slice(0, 10),
    status: body.status ?? "draft",
    currency: body.currency ?? "EUR",
    lineItems:
      body.lineItems.length > 0 ? mapLineItems(body.lineItems) : [createEmptyLineItem()],
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
  };

  return upsertInvoice(userId, invoice);
}
