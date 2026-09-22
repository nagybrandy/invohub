// lib/invoices/draft-preview.ts
// Parses the composer's UNSAVED invoice payload for the live PDF side
// preview (POST /api/invoices/preview/pdf). The payload comes straight from
// the client, so every field is re-read defensively: unknown enums fall back
// to safe defaults, non-finite numbers become 0, text is clipped, and the
// line-item count is capped — pdfkit must never throw (or spin) on it.
// The result is always rendered as an unnumbered draft: the number prints
// as the "Piszkozat" placeholder and the status chip as PISZKOZAT, so a
// preview can never pass for a finalized document.
import type {
  Invoice,
  InvoiceCurrency,
  InvoiceDocumentType,
  InvoiceLineItem,
  PaymentMethod,
  VatCategory,
  VatRate,
} from "@/lib/invoices/types";

export const DRAFT_PREVIEW_MAX_LINE_ITEMS = 200;

const DOCUMENT_TYPES: InvoiceDocumentType[] = ["invoice", "proforma", "advance", "storno", "modify"];
const CURRENCIES: InvoiceCurrency[] = ["HUF", "EUR"];
const PAYMENT_METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];
const VAT_CATEGORIES: VatCategory[] = ["normal", "AAM", "TAM", "KBAET", "AHK", "FAD", "ATK"];
const VAT_RATES: VatRate[] = [0, 5, 18, 27];

type Parsed = { ok: true; invoice: Invoice } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  if (typeof value === "number") return String(value).slice(0, max);
  return typeof value === "string" ? value.slice(0, max) : "";
}

function optionalText(value: unknown, max: number): string | undefined {
  const result = text(value, max).trim();
  return result ? result : undefined;
}

function finite(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function dateText(value: unknown): string {
  const raw = text(value, 40);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
}

function parseLineItem(value: unknown, index: number): InvoiceLineItem {
  const item = isRecord(value) ? value : {};
  const vatCategory = oneOf(item.vatCategory, VAT_CATEGORIES, "normal");
  return {
    id: text(item.id, 64) || `line-${index + 1}`,
    description: text(item.description, 2000),
    quantity: finite(item.quantity),
    unitPrice: finite(item.unitPrice),
    vatRate: oneOf(finite(item.vatRate) as VatRate, VAT_RATES, vatCategory === "normal" ? 27 : 0),
    vatCategory,
    vatExemptionReason: optionalText(item.vatExemptionReason, 500),
    unit: optionalText(item.unit, 32),
  };
}

export function parseDraftPreviewInvoice(body: unknown): Parsed {
  if (!isRecord(body) || !isRecord(body.invoice)) {
    return { ok: false, error: "Invoice payload required." };
  }
  const raw = body.invoice;
  if (!Array.isArray(raw.lineItems)) {
    return { ok: false, error: "Invoice lineItems must be an array." };
  }
  if (raw.lineItems.length > DRAFT_PREVIEW_MAX_LINE_ITEMS) {
    return { ok: false, error: `At most ${DRAFT_PREVIEW_MAX_LINE_ITEMS} line items can be previewed.` };
  }

  const currency = oneOf(raw.currency, CURRENCIES, "HUF");
  const exchangeRate = finite(raw.exchangeRate);
  const now = new Date().toISOString();
  const paymentMethod = PAYMENT_METHODS.includes(raw.paymentMethod as PaymentMethod)
    ? (raw.paymentMethod as PaymentMethod)
    : undefined;

  return {
    ok: true,
    invoice: {
      id: "draft-preview",
      invoiceNumber: "",
      documentType: oneOf(raw.documentType, DOCUMENT_TYPES, "invoice"),
      clientName: text(raw.clientName, 500).trim() || "—",
      clientTaxNumber: optionalText(raw.clientTaxNumber, 64),
      clientId: optionalText(raw.clientId, 64),
      // Buyer address snapshot (Áfa tv. 169. § e) — the preview must show what the finalized PDF will.
      clientZipCode: optionalText(raw.clientZipCode, 16),
      clientCity: optionalText(raw.clientCity, 120),
      clientAddress: optionalText(raw.clientAddress, 300),
      clientCountry: optionalText(raw.clientCountry, 80),
      clientEuVatNumber: optionalText(raw.clientEuVatNumber, 32),
      issueDate: dateText(raw.issueDate),
      dueDate: dateText(raw.dueDate),
      status: "draft",
      currency,
      exchangeRate: currency !== "HUF" && exchangeRate > 0 ? exchangeRate : undefined,
      lineItems: raw.lineItems.map(parseLineItem),
      notes: optionalText(raw.notes, 10_000),
      paymentMethod,
      createdAt: now,
      updatedAt: now,
    },
  };
}
