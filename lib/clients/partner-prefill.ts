// lib/clients/partner-prefill.ts
// Maps a partner's `usual` settings (lib/clients/suggestions-core.ts) onto
// composer changes. Pure. Dates are never copied: the payment term is a
// number of days applied to TODAY's issue date by the composer, and the MNB
// rate is re-fetched by the composer's own currency/date effect.
import type { PartnerUsual, SuggestedLineItem } from "@/lib/clients/suggestions-core";
import type { DocumentLanguage } from "@/lib/companies/billing-settings";
import type { InvoiceLineItem, PaymentMethod, VatCategory, VatRate } from "@/lib/invoices/types";

export type ComposerPrefillPatch = {
  currency?: string;
  language?: DocumentLanguage;
  paymentMethod?: PaymentMethod;
  deadlineDays?: number;
  /** Applied to untouched starter lines only. */
  vat?: { rate: VatRate; category: VatCategory };
};

export function usualToComposerPatch(usual: PartnerUsual): ComposerPrefillPatch {
  const patch: ComposerPrefillPatch = {};
  if (usual.currency) patch.currency = usual.currency;
  if (usual.language) patch.language = usual.language;
  if (usual.paymentMethod) patch.paymentMethod = usual.paymentMethod;
  if (usual.paymentTermDays !== undefined) patch.deadlineDays = usual.paymentTermDays;
  if (usual.vat) patch.vat = usual.vat;
  return patch;
}

/** A line the person has not touched: no description and no price. */
export function isPristineLine(line: InvoiceLineItem): boolean {
  return !line.description.trim() && !line.unitPrice;
}

export function applyVatToPristineLines(
  lines: InvoiceLineItem[],
  vat: { rate: VatRate; category: VatCategory }
): InvoiceLineItem[] {
  return lines.map((l) => (isPristineLine(l) ? { ...l, vatRate: vat.rate, vatCategory: vat.category } : l));
}

/**
 * "Előző tételek betöltése": the previous invoice's lines (fresh ids) REPLACE
 * the untouched starter line(s) and are APPENDED after anything the person
 * already typed — existing content is never overwritten.
 */
export function appendPreviousItems(
  lines: InvoiceLineItem[],
  previous: SuggestedLineItem[],
  newId: () => string
): InvoiceLineItem[] {
  const kept = lines.filter((l) => !isPristineLine(l));
  const added: InvoiceLineItem[] = previous.map((p) => ({
    id: newId(),
    description: p.description,
    quantity: p.quantity,
    unit: p.unit ?? "db",
    unitPrice: p.unitPrice,
    vatRate: p.vatRate,
    vatCategory: p.vatCategory,
  }));
  return [...kept, ...added];
}
