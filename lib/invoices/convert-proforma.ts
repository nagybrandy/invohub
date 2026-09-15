// lib/invoices/convert-proforma.ts
// Pure logic for "Számla készítése ebből" — turning a paid díjbekérő
// (proforma) into a real invoice draft. No DB access here; see
// lib/invoices/service.ts (convertProformaToInvoice) for persistence.
import { createId } from "@/lib/id";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";

/**
 * Day span between two YYYY-MM-DD dates, computed on UTC midnight (no
 * timezone arithmetic). Never negative — a reversed or equal pair is 0.
 */
export function dueDateSpanDays(issueDate: string, dueDate: string): number {
  const issue = Date.parse(`${issueDate}T00:00:00.000Z`);
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  const days = Math.round((due - issue) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

export type CanConvertProformaResult =
  | { ok: true }
  | { ok: false; reason: "notProforma" | "cancelled" };

/** Only a non-cancelled díjbekérő (proforma) can be converted into an invoice. */
export function canConvertProforma(
  invoice: Pick<Invoice, "documentType" | "status">
): CanConvertProformaResult {
  if (invoice.documentType !== "proforma") {
    return { ok: false, reason: "notProforma" };
  }
  if (invoice.status === "cancelled") {
    return { ok: false, reason: "cancelled" };
  }
  return { ok: true };
}

function addDaysIso(dateIso: string, days: number): string {
  const base = Date.parse(`${dateIso}T00:00:00.000Z`);
  const result = new Date(base + days * 24 * 60 * 60 * 1000);
  return result.toISOString().slice(0, 10);
}

/**
 * Builds a draft invoice from a díjbekérő: recomputed dates (issue = today,
 * due = today + the source's day span), copied partner/currency/payment
 * fields, cleared payment/link fields, fresh line-item ids, and a notes
 * line referencing the source's number.
 */
export function buildInvoiceFromProforma(proforma: Invoice, today: string): Invoice {
  const now = new Date().toISOString();
  const span = dueDateSpanDays(proforma.issueDate, proforma.dueDate);
  const reference = `Díjbekérő alapján: ${proforma.invoiceNumber || proforma.id}`;
  const notes = proforma.notes ? `${proforma.notes}\n${reference}` : reference;

  const newId = createId();
  const lineItems: InvoiceLineItem[] = proforma.lineItems.map((item) => ({
    ...item,
    id: createId(),
  }));

  return {
    ...proforma,
    id: newId,
    invoiceNumber: "",
    documentType: "invoice",
    status: "draft",
    issueDate: today,
    dueDate: addDaysIso(today, span),
    notes,
    lineItems,
    paidAt: undefined,
    paidAmount: undefined,
    originalInvoiceId: undefined,
    modifiesInvoiceId: undefined,
    modificationIndex: undefined,
    convertedFromInvoiceId: proforma.id,
    createdAt: now,
    updatedAt: now,
  };
}
