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
   * Unit of measure (db/óra/nap/…). UI-only field for the composer grid —
   * optional so it never forces a value NAV submission doesn't expect yet.
   * Persistence beyond the in-memory invoice is a separate, NAV-gated
   * queue item (see docs/design/app-ux-spec-2026-09-14.md §2.4).
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
