// lib/clients/suggestions-core.ts
// Pure part of the composer's "partners you already invoiced" suggestions:
// ranking, matching and deriving the "usual" settings from a partner's most
// recent ISSUED invoice. No I/O — the DB loader is lib/clients/suggestions.ts.
// Client-safe (types are imported by the hook and the composer).
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "@/lib/companies/billing-settings";
import type { PaymentMethod, VatCategory, VatRate } from "@/lib/invoices/types";

export const SUGGESTION_LIMIT = 8;
const PAYMENT_METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];
const VAT_CATEGORIES: VatCategory[] = ["normal", "AAM", "TAM", "KBAET", "AHK", "FAD", "ATK"];
const VAT_RATES: VatRate[] = [0, 5, 18, 27];

export type SuggestedPartner = {
  /** Saved partner row, or null for a composer-local partner known only from its invoices. */
  clientId: string | null;
  name: string;
  taxNumber?: string;
  euVatNumber?: string;
  email?: string;
  country?: string;
  zipCode?: string;
  city?: string;
  address?: string;
  partyType?: string;
};

/** A past line, WITHOUT ids — the composer assigns fresh ones when loading. */
export type SuggestedLineItem = {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate: VatRate;
  vatCategory: VatCategory;
};

/** What the person usually sets for this partner. Never contains dates. */
export type PartnerUsual = {
  currency?: string;
  language?: DocumentLanguage;
  paymentMethod?: PaymentMethod;
  /** due date minus issue date of the last invoice, in days. */
  paymentTermDays?: number;
  /** Present only when every line of that invoice used the same treatment. */
  vat?: { rate: VatRate; category: VatCategory };
  lineItems: SuggestedLineItem[];
};

export type PartnerSuggestion = {
  partner: SuggestedPartner;
  invoiceCount: number;
  lastIssueDate: string;
  /** The invoice `usual` was derived from (used by the loader to fetch its lines). */
  latestInvoiceId: string;
  usual: PartnerUsual;
};

export type SuggestionInvoiceRow = {
  id: string;
  userId: string;
  clientId: string | null;
  clientName: string;
  clientTaxNumber: string | null;
  clientZipCode?: string | null;
  clientCity?: string | null;
  clientAddress?: string | null;
  clientCountry?: string | null;
  clientEuVatNumber?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  language: string | null;
  paymentMethod: string | null;
  documentType: string;
  status: string;
};

export type SuggestionLineRow = {
  invoiceId: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  unit: string | null;
  vatRate: number;
  vatCategory: string;
  vatExemptionReason?: string | null;
  comment?: string | null;
  sortOrder: number;
};

export type SuggestionClientRow = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  taxNumber?: string;
  euVatNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  partyType?: string;
};

/** Lower-case, accent-free text for matching ("Kovács" ~ "kovacs"). */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const digits = (v: string) => v.replace(/\D/g, "");

function dayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.round(ms / 86_400_000);
}

/** Days from issue to due date; undefined when it is not a sensible 0–366 day term. */
export function paymentTermDays(issueDate: string, dueDate: string): number | undefined {
  const a = dayNumber(issueDate);
  const b = dayNumber(dueDate);
  if (a === null || b === null) return undefined;
  const days = b - a;
  return days >= 0 && days <= 366 ? days : undefined;
}

/** Documents that count as "I invoiced this partner": issued real invoices. */
export function isSuggestionSource(row: Pick<SuggestionInvoiceRow, "status" | "documentType">): boolean {
  if (row.status === "draft" || row.status === "proforma") return false;
  return row.documentType === "invoice";
}

function partnerKey(row: SuggestionInvoiceRow): string {
  if (row.clientId) return `id:${row.clientId}`;
  const tax = digits(row.clientTaxNumber ?? "").slice(0, 8);
  return tax ? `tax:${tax}` : `name:${foldText(row.clientName)}`;
}

function deriveUsual(row: SuggestionInvoiceRow, lines: SuggestionLineRow[]): PartnerUsual {
  const sorted = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const lineItems: SuggestedLineItem[] = sorted.map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    ...(l.unit ? { unit: l.unit } : {}),
    unitPrice: Number(l.unitPrice),
    vatRate: (VAT_RATES.includes(l.vatRate as VatRate) ? l.vatRate : 27) as VatRate,
    vatCategory: (VAT_CATEGORIES.includes(l.vatCategory as VatCategory) ? l.vatCategory : "normal") as VatCategory,
  }));

  const first = lineItems[0];
  const sameVat = first && lineItems.every((l) => l.vatRate === first.vatRate && l.vatCategory === first.vatCategory);
  const term = paymentTermDays(row.issueDate, row.dueDate);

  return {
    ...(row.currency ? { currency: row.currency } : {}),
    ...((DOCUMENT_LANGUAGES as readonly string[]).includes(row.language ?? "")
      ? { language: row.language as DocumentLanguage }
      : {}),
    ...(PAYMENT_METHODS.includes(row.paymentMethod as PaymentMethod)
      ? { paymentMethod: row.paymentMethod as PaymentMethod }
      : {}),
    ...(term !== undefined ? { paymentTermDays: term } : {}),
    ...(sameVat ? { vat: { rate: first.vatRate, category: first.vatCategory } } : {}),
    lineItems,
  };
}

function partnerFrom(row: SuggestionInvoiceRow, client: SuggestionClientRow | undefined): SuggestedPartner {
  if (client) {
    return {
      clientId: client.id,
      name: client.name,
      ...(client.taxNumber ? { taxNumber: client.taxNumber } : {}),
      ...(client.euVatNumber ? { euVatNumber: client.euVatNumber } : {}),
      ...(client.email ? { email: client.email } : {}),
      ...(client.country ? { country: client.country } : {}),
      ...(client.zipCode ? { zipCode: client.zipCode } : {}),
      ...(client.city ? { city: client.city } : {}),
      ...(client.address ? { address: client.address } : {}),
      ...(client.partyType ? { partyType: client.partyType } : {}),
    };
  }
  return {
    clientId: row.clientId ?? null,
    name: row.clientName,
    ...(row.clientTaxNumber ? { taxNumber: row.clientTaxNumber } : {}),
    ...(row.clientEuVatNumber ? { euVatNumber: row.clientEuVatNumber } : {}),
    ...(row.clientCountry ? { country: row.clientCountry } : {}),
    ...(row.clientZipCode ? { zipCode: row.clientZipCode } : {}),
    ...(row.clientCity ? { city: row.clientCity } : {}),
    ...(row.clientAddress ? { address: row.clientAddress } : {}),
  };
}

/**
 * Groups issued invoices by partner, ranks them (most recent issue date, then
 * invoice count), filters by the typed text (name accent/case-insensitively,
 * tax number by digits) and attaches each partner's `usual` settings.
 * Rows of any other account are dropped here too — the loader already scopes
 * the query by account; this is the second lock.
 */
export function buildPartnerSuggestions(
  invoices: SuggestionInvoiceRow[],
  lines: SuggestionLineRow[],
  options: { userId: string; query: string; limit?: number; clients?: SuggestionClientRow[] }
): PartnerSuggestion[] {
  const { userId, query, limit = SUGGESTION_LIMIT } = options;
  const clientsById = new Map(
    (options.clients ?? []).filter((c) => c.userId === userId).map((c) => [c.id, c] as const)
  );

  const groups = new Map<string, SuggestionInvoiceRow[]>();
  for (const row of invoices) {
    if (row.userId !== userId || !isSuggestionSource(row)) continue;
    const key = partnerKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const q = foldText(query);
  const qDigits = digits(query);
  const linesByInvoice = new Map<string, SuggestionLineRow[]>();
  for (const l of lines) {
    const list = linesByInvoice.get(l.invoiceId);
    if (list) list.push(l);
    else linesByInvoice.set(l.invoiceId, [l]);
  }

  const out: PartnerSuggestion[] = [];
  for (const group of groups.values()) {
    const latest = group.reduce((best, r) => (r.issueDate > best.issueDate ? r : best));
    const client = latest.clientId ? clientsById.get(latest.clientId) : undefined;
    const partner = partnerFrom(latest, client);

    if (q) {
      const nameHit = foldText(partner.name).includes(q);
      const taxHit = qDigits.length >= 2 && digits(partner.taxNumber ?? "").includes(qDigits);
      if (!nameHit && !taxHit) continue;
    }

    out.push({
      partner,
      invoiceCount: group.length,
      lastIssueDate: latest.issueDate,
      latestInvoiceId: latest.id,
      usual: deriveUsual(latest, linesByInvoice.get(latest.id) ?? []),
    });
  }

  out.sort(
    (a, b) =>
      b.lastIssueDate.localeCompare(a.lastIssueDate) ||
      b.invoiceCount - a.invoiceCount ||
      a.partner.name.localeCompare(b.partner.name)
  );
  return out.slice(0, limit);
}
