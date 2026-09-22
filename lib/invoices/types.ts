// lib/invoices/types.ts
// Domain types for invoices (served from Neon via lib/invoices/service.ts).

export type InvoiceStatus =
  | "draft"
  | "proforma"
  | "sent"
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "overdue"
  | "cancelled";

/** Drives the numbering prefix (INV-/DBK-/ELO-) and which NAV document kind is submitted. */
export type InvoiceDocumentType =
  | "invoice"
  | "proforma"
  | "advance"
  | "storno"
  | "modify";

export type VatRate = 0 | 5 | 18 | 27;

/**
 * NAV-style VAT treatment per line:
 * - normal: taxed at 0/5/18/27%
 * - AAM: alanyi adómentes (VAT-exempt sole trader status)
 * - TAM: tárgyi adómentes (subject-matter exempt)
 * - KBAET: EU intra-community exempt (new means of transport)
 * - AHK: EU intra-community exempt (excise goods)
 * - FAD: fordított adózás (domestic reverse charge)
 * - ATK: outside the scope of VAT ("áfa tárgyi hatályán kívüli")
 */
export type VatCategory = "normal" | "AAM" | "TAM" | "KBAET" | "AHK" | "FAD" | "ATK";

export type InvoiceCurrency = "EUR" | "HUF";

export type PaymentMethod = "transfer" | "cash" | "card" | "other";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: VatRate;
  vatCategory: VatCategory;
  /** Human-readable exemption/reverse-charge reason. Auto-filled from vatCategory when omitted. */
  vatExemptionReason?: string;
  /**
   * Unit of measure (db/óra/nap/…) — nullable/additive column on
   * invoice_line_item, shown next to quantity on the PDF/HTML document.
   * Optional so it never forces a value NAV submission doesn't expect yet.
   */
  unit?: string;
}

export interface Invoice {
  id: string;
  /** Empty string until finalized (assigned atomically from lib/invoices/numbering.ts). */
  invoiceNumber: string;
  documentType: InvoiceDocumentType;
  clientName: string;
  clientTaxNumber?: string;
  /**
   * Buyer address SNAPSHOT as of issuance (Áfa tv. 169. § e) — captured at
   * save time, independent of the linked client (which may move
   * afterwards). See lib/invoices/build-pdf-context.ts for the fallback to
   * the linked client on invoices saved before this existed.
   */
  clientZipCode?: string;
  clientCity?: string;
  clientAddress?: string;
  clientCountry?: string;
  clientEuVatNumber?: string;
  /** Linked partner row when the invoice was created from the client picker. */
  clientId?: string;
  issueDate: string;
  dueDate: string;
  /**
   * Teljesítés dátuma — ISO `YYYY-MM-DD` performance date (Áfa tv. 169. §;
   * also the NAV `<invoiceDeliveryDate>`). Optional: when unset, callers
   * fall back to `issueDate` (see lib/invoices/fulfillment-date.ts's
   * resolveFulfillmentDate for the DB read-time legacy-notes fallback, and
   * lib/nav/invoice-xml.ts's buildNavInvoiceXml for the NAV precedence
   * chain — invoiceDeliveryDate override ?? fulfillmentDate ?? issueDate).
   */
  fulfillmentDate?: string;
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  /** Manual HUF exchange rate for non-HUF invoices. */
  exchangeRate?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  paidAmount?: number;
  /** Present on a storno document; points at the invoice it cancels. */
  originalInvoiceId?: string;
  /** Present on a helyesbítő (correction) document; points at what it modifies. */
  modifiesInvoiceId?: string;
  /** 1-based count of corrections issued against the same original invoice. */
  modificationIndex?: number;
  /** Present on a számla created from a díjbekérő; points back at the proforma. */
  convertedFromInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTotals {
  subtotal: number;
  vatTotal: number;
  totalAmount: number;
}

export function hasInvoiceNumber(invoice: Pick<Invoice, "invoiceNumber">): boolean {
  return invoice.invoiceNumber.trim().length > 0;
}

/**
 * Áfa tv. 169. § e) requires the buyer's name AND address on the invoice —
 * checked at finalization time (see lib/invoices/service.ts's
 * finalizeInvoice and lib/invoices/create-from-payload.ts). A draft may
 * still be missing these; only finalizing (or creating already-finalized
 * via the external API) is gated on this.
 */
export function hasBuyerAddress(
  invoice: Pick<Invoice, "clientName" | "clientZipCode" | "clientCity" | "clientAddress">
): boolean {
  return Boolean(
    invoice.clientName?.trim() &&
      invoice.clientZipCode?.trim() &&
      invoice.clientCity?.trim() &&
      invoice.clientAddress?.trim()
  );
}

/**
 * Whether hasBuyerAddress must hold before this invoice may be saved. A
 * proforma (díjbekérő) is never an accounting document under Áfa tv. 169. §
 * — it cannot be cancelled/corrected like a real invoice either (see
 * lib/invoices/service.ts's storno/modify guards) — so only a document
 * leaving "draft" for a real invoice-type document (invoice/advance/
 * storno/modify) requires the buyer address.
 */
export function requiresCompleteBuyerAddress(
  invoice: Pick<Invoice, "status" | "documentType">
): boolean {
  return invoice.status !== "draft" && invoice.documentType !== "proforma";
}
