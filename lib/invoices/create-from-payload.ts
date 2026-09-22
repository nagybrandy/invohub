// lib/invoices/create-from-payload.ts
// Validates and builds an Invoice from API / external payloads.
import { getCompanyByUserId } from "@/lib/companies/service";
import { validateEmailRecipientsInput } from "@/lib/email/recipients";
import { requiresExchangeRate } from "@/lib/invoices/exchange-rate";
import { isPaymentMethod, PAYMENT_METHODS } from "@/lib/invoices/payment-status";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import { VAT_CATEGORIES, VAT_RATES } from "@/lib/invoices/vat";
import { BuyerAddressMissingError } from "@/lib/invoices/errors";
import { hasBuyerAddress, requiresCompleteBuyerAddress } from "@/lib/invoices/types";
import type {
  Invoice,
  InvoiceCurrency,
  InvoiceDocumentType,
  InvoiceLineItem,
  InvoiceStatus,
  PaymentMethod,
  VatCategory,
  VatRate,
} from "@/lib/invoices/types";
import { createId } from "@/lib/id";

// Re-exported so existing importers of create-from-payload.ts keep working
// (BuyerAddressMissingError previously lived here) — see lib/invoices/errors.ts
// for why the class itself was moved to a DB-import-free module.
export { BuyerAddressMissingError };

const STATUSES: InvoiceStatus[] = [
  "draft",
  "proforma",
  "sent",
  "paid",
  "partially_paid",
  "unpaid",
  "overdue",
  "cancelled",
];

const DOCUMENT_TYPES: InvoiceDocumentType[] = [
  "invoice",
  "proforma",
  "advance",
  "storno",
  "modify",
];

export type ExternalLineItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate?: VatRate;
  vatCategory?: VatCategory;
  vatExemptionReason?: string;
  /** Unit of measure (db/óra/nap/…), shown next to quantity on PDF/HTML. */
  unit?: string;
};

export type ExternalInvoiceInput = {
  invoiceNumber?: string;
  documentType?: InvoiceDocumentType;
  clientName: string;
  clientTaxNumber?: string;
  /** Buyer address SNAPSHOT (Áfa tv. 169. § e) — required to finalize (status other than "draft"). */
  clientZipCode?: string;
  clientCity?: string;
  clientAddress?: string;
  clientCountry?: string;
  clientEuVatNumber?: string;
  issueDate?: string;
  dueDate?: string;
  status?: InvoiceStatus;
  currency?: InvoiceCurrency;
  /** Manual HUF exchange rate — required (positive, finite) when currency isn't HUF. */
  exchangeRate?: number;
  lineItems: ExternalLineItemInput[];
  notes?: string;
  paymentMethod?: PaymentMethod;
  submitToNav?: boolean;
  /** Send invoice email immediately after creation (default true). */
  sendEmail?: boolean;
  /** Override To recipients; string, comma-separated string, or array. */
  emailTo?: string | string[];
  /** Override Cc recipients; string, comma-separated string, or array. */
  emailCc?: string | string[];
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
    if (item.vatCategory !== undefined && !VAT_CATEGORIES.includes(item.vatCategory)) {
      return `lineItems[${index}].vatCategory must be one of ${VAT_CATEGORIES.join(", ")}.`;
    }
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return `status must be one of ${STATUSES.join(", ")}.`;
  }
  if (body.documentType && !DOCUMENT_TYPES.includes(body.documentType)) {
    return `documentType must be one of ${DOCUMENT_TYPES.join(", ")}.`;
  }
  if (body.currency && body.currency !== "EUR" && body.currency !== "HUF") {
    return "currency must be EUR or HUF.";
  }
  if (body.currency && requiresExchangeRate(body.currency)) {
    if (
      typeof body.exchangeRate !== "number" ||
      !Number.isFinite(body.exchangeRate) ||
      body.exchangeRate <= 0
    ) {
      return "exchangeRate must be a number greater than zero for a non-HUF currency.";
    }
  }
  if (body.paymentMethod !== undefined && !isPaymentMethod(body.paymentMethod)) {
    return `paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}.`;
  }

  const emailToError = validateEmailRecipientsInput("emailTo", body.emailTo);
  if (emailToError) return emailToError;

  const emailCcError = validateEmailRecipientsInput("emailCc", body.emailCc);
  if (emailCcError) return emailCcError;

  return null;
}

export function mapLineItems(
  items: ExternalLineItemInput[],
  companyVatExempt: boolean
): InvoiceLineItem[] {
  return items.map((item) => {
    const vatCategory: VatCategory = item.vatCategory ?? (companyVatExempt ? "AAM" : "normal");
    return {
      id: createId(),
      description: item.description.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: vatCategory === "normal" ? item.vatRate ?? 27 : 0,
      vatCategory,
      vatExemptionReason: item.vatExemptionReason,
      unit: item.unit,
    };
  });
}

export async function createInvoiceFromPayload(
  userId: string,
  body: ExternalInvoiceInput
): Promise<Invoice> {
  const validationError = validateExternalInvoiceInput(body);
  if (validationError) {
    throw new Error(validationError);
  }

  const company = await getCompanyByUserId(userId);
  const now = new Date().toISOString();
  const currency: InvoiceCurrency =
    body.currency ?? (company?.country === "HU" || !company?.country ? "HUF" : "EUR");
  const invoice: Invoice = {
    id: createId(),
    // Left blank on drafts — lib/invoices/service.ts assigns a number atomically at finalize time.
    invoiceNumber: body.invoiceNumber?.trim() ?? "",
    documentType: body.documentType ?? "invoice",
    clientName: body.clientName.trim(),
    clientTaxNumber: body.clientTaxNumber?.trim(),
    clientZipCode: body.clientZipCode?.trim(),
    clientCity: body.clientCity?.trim(),
    clientAddress: body.clientAddress?.trim(),
    clientCountry: body.clientCountry?.trim(),
    clientEuVatNumber: body.clientEuVatNumber?.trim(),
    issueDate: body.issueDate ?? now.slice(0, 10),
    dueDate: body.dueDate ?? body.issueDate ?? now.slice(0, 10),
    status: body.status ?? "draft",
    currency,
    exchangeRate: requiresExchangeRate(currency) ? body.exchangeRate : undefined,
    lineItems: mapLineItems(body.lineItems, company?.vatExempt ?? false),
    notes: body.notes,
    paymentMethod: body.paymentMethod,
    createdAt: now,
    updatedAt: now,
  };

  // Áfa tv. 169. § e) — a finalized (non-draft) document must show the
  // buyer's name and address. A draft may still be incomplete, and a
  // proforma (díjbekérő) is never gated — it isn't an accounting document.
  if (requiresCompleteBuyerAddress(invoice) && !hasBuyerAddress(invoice)) {
    throw new BuyerAddressMissingError();
  }

  return upsertInvoice(userId, invoice);
}

export type UpdateDraftInvoiceResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_draft" }
  | { ok: false; reason: "validation"; message: string }
  | { ok: false; reason: "buyer_address_missing" };

/**
 * PATCH /api/v1/invoices/:id — a DRAFT-only, full-body update. Reuses
 * validateExternalInvoiceInput (same rules as create) and mapLineItems (same
 * VAT-category defaulting) so the external API never validates a draft edit
 * more loosely than a create. A non-draft invoice is refused with
 * reason: "not_draft" — a finalized/numbered document is never edited this
 * way (storno/modify are the correction path).
 */
export async function updateDraftInvoiceFromPayload(
  userId: string,
  id: string,
  body: Partial<ExternalInvoiceInput>
): Promise<UpdateDraftInvoiceResult> {
  const existing = await getInvoiceById(userId, id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status !== "draft") return { ok: false, reason: "not_draft" };

  const validationError = validateExternalInvoiceInput(body);
  if (validationError) return { ok: false, reason: "validation", message: validationError };

  const company = await getCompanyByUserId(userId);
  const currency: InvoiceCurrency = body.currency ?? existing.currency;
  const updated: Invoice = {
    ...existing,
    invoiceNumber: body.invoiceNumber?.trim() ?? existing.invoiceNumber,
    documentType: body.documentType ?? existing.documentType,
    clientName: body.clientName!.trim(),
    clientTaxNumber: body.clientTaxNumber?.trim() ?? existing.clientTaxNumber,
    clientZipCode: body.clientZipCode?.trim() ?? existing.clientZipCode,
    clientCity: body.clientCity?.trim() ?? existing.clientCity,
    clientAddress: body.clientAddress?.trim() ?? existing.clientAddress,
    clientCountry: body.clientCountry?.trim() ?? existing.clientCountry,
    clientEuVatNumber: body.clientEuVatNumber?.trim() ?? existing.clientEuVatNumber,
    issueDate: body.issueDate ?? existing.issueDate,
    dueDate: body.dueDate ?? body.issueDate ?? existing.dueDate,
    status: body.status ?? existing.status,
    currency,
    exchangeRate: requiresExchangeRate(currency)
      ? (body.exchangeRate ?? existing.exchangeRate)
      : undefined,
    lineItems: mapLineItems(body.lineItems!, company?.vatExempt ?? false),
    notes: body.notes ?? existing.notes,
    paymentMethod: body.paymentMethod ?? existing.paymentMethod,
    updatedAt: new Date().toISOString(),
  };

  // Áfa tv. 169. § e) — an update that finalizes the draft (status moves
  // off "draft") must carry a complete buyer name+address.
  if (requiresCompleteBuyerAddress(updated) && !hasBuyerAddress(updated)) {
    return { ok: false, reason: "buyer_address_missing" };
  }

  const saved = await upsertInvoice(userId, updated);
  return { ok: true, invoice: saved };
}
