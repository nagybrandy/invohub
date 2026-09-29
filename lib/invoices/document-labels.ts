// lib/invoices/document-labels.ts
// Document-facing vocabulary + formatting for the outgoing bizonylat (HTML
// preview and PDF). Reads straight from the locale data modules
// (lib/i18n/locales/hu.ts / en.ts) instead of lib/i18n/index.ts (i18next) —
// this must run server-side (API routes, PDF generation) without touching
// client-only i18n init, and it must NOT follow the app UI's language: the
// outgoing document defaults to Hungarian regardless of what language the
// signed-in user has the app set to (an EN-UI user still issues a Hungarian
// bizonylat). Pass locale="en" explicitly for the rare case an English
// document is wanted.
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";
import type { InvoiceCurrency, InvoiceDocumentType, InvoiceStatus } from "@/lib/invoices/types";

export type DocumentLocale = "hu" | "en";

const LOCALES: Record<DocumentLocale, typeof hu> = { hu, en };

export type DocumentLabels = typeof hu.invoices.document & {
  documentTypes: typeof hu.invoices.documentTypes;
  status: typeof hu.invoices.status;
  paymentMethods: typeof hu.invoices.paymentMethods;
};

/** Every document-facing label, read straight from the locale modules — hu by default. */
export function documentLabels(locale: DocumentLocale = "hu"): DocumentLabels {
  const strings = LOCALES[locale].invoices;
  return {
    ...strings.document,
    documentTypes: strings.documentTypes,
    status: strings.status,
    paymentMethods: strings.paymentMethods,
  };
}

/** The title printed on the document itself, per documentType (AC7). */
export function documentTitleFor(
  documentType: InvoiceDocumentType,
  locale: DocumentLocale = "hu"
): string {
  return LOCALES[locale].invoices.documentTypes[documentType];
}

// The document stops printing internal bookkeeping state (plan §1(b)): the
// status chip renders only for statuses that change what the document *is*.
// "sent"/"unpaid"/"overdue"/"partially_paid" are app state, not document
// content, and print nothing.
const PRINTED_STATUSES = new Set<InvoiceStatus>(["draft", "paid", "cancelled"]);

/** The status chip text to print, or null when this status prints nothing (plan §1(b)). */
export function documentStatusChip(
  status: InvoiceStatus,
  locale: DocumentLocale = "hu"
): string | null {
  if (!PRINTED_STATUSES.has(status)) return null;
  return LOCALES[locale].invoices.status[status as "draft" | "paid" | "cancelled"];
}

/**
 * Hungarian money formatting for the outgoing document — explicit `hu-HU`,
 * independent of the server's default locale (a Vercel lambda's default
 * locale is not Hungarian, so `toLocaleString(undefined, …)` renders
 * `1,234,567 Ft` to a Hungarian customer). Narrow/no-break space (U+00A0)
 * between thousands groups and before the currency symbol.
 */
/**
 * A value that rounds to zero at `fractionDigits` becomes a plain 0, so a
 * helyesbítő whose reversing and copied lines cancel (or a float residue
 * like -1e-13) never prints "-0 Ft" / "-0,00 €". Real negatives (storno and
 * reversing lines) keep their sign.
 */
export function withoutNegativeZero(value: number, fractionDigits: number): number {
  return Math.abs(value) < 0.5 / 10 ** fractionDigits ? 0 : value;
}

export function formatDocumentAmount(amount: number, currency: InvoiceCurrency): string {
  const symbol = currency === "EUR" ? "€" : "Ft";
  const fractionDigits = currency === "EUR" ? 2 : 0;
  const formatted = new Intl.NumberFormat("hu-HU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(withoutNegativeZero(amount, fractionDigits));
  return `${formatted} ${symbol}`;
}

const DOMESTIC_COUNTRY_NAMES = new Set(["magyarország", "hungary", "hu", "hun"]);

/**
 * One Hungarian-ordered address line for a party block: "1114 Budapest,
 * Bartók Béla út 42." — postcode + city first, then the street. The country
 * is appended only for a non-Hungarian address (a domestic invoice printing
 * "Magyarország" on every party is noise). Empty string when nothing is set.
 */
export function formatPartyAddress(parts: {
  zipCode?: string;
  city?: string;
  address?: string;
  country?: string;
}): string {
  const locality = [parts.zipCode?.trim(), parts.city?.trim()].filter(Boolean).join(" ");
  const line = [locality, parts.address?.trim()].filter(Boolean).join(", ");
  const country = parts.country?.trim();
  if (country && !DOMESTIC_COUNTRY_NAMES.has(country.toLowerCase())) {
    return line ? `${line}, ${country}` : country;
  }
  return line;
}

/** Quantity with Hungarian decimal comma ("1,5"), plus the unit when the line has one ("24 óra"). */
export function formatDocumentQuantity(quantity: number, unit?: string): string {
  const formatted = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 3, useGrouping: true }).format(
    withoutNegativeZero(quantity, 3)
  );
  const trimmedUnit = unit?.trim();
  return trimmedUnit ? `${formatted} ${trimmedUnit}` : formatted;
}

// FALLBACK PATH ONLY. lib/invoices/pdf-fonts.ts embeds a real
// Latin-Extended-A TrueType font (Noto Sans) so the normal PDF path draws
// ő/ű directly — see docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md.
// pdfkit's built-in Helvetica AFM writes WinAnsi (cp1252) only, which has no
// glyph for U+0151 (ő) / U+0171 (ű) — pdfkit emits them as raw two-byte
// codes, which every PDF viewer renders as garbage. generate-pdf.ts uses
// this transliteration only when the embedded font files can't be resolved
// (a bundling regression), as a loud, still-legible last resort — never on
// the normal path.
const WINANSI_UNSAFE_MAP: Record<string, string> = {
  ő: "ö",
  Ő: "Ö",
  ű: "ü",
  Ű: "Ü",
};
const WINANSI_UNSAFE_RE = /[őŐűŰ]/g;

/** Transliterates ő→ö / ű→ü (+ uppercase) so pdfkit's WinAnsi Helvetica can draw the string. */
export function toWinAnsiSafe(value: string): string {
  return value.replace(WINANSI_UNSAFE_RE, (ch) => WINANSI_UNSAFE_MAP[ch] ?? ch);
}

/** True when a string contains no character pdfkit's WinAnsi Helvetica would corrupt. */
export function isWinAnsiSafe(value: string): boolean {
  return !new RegExp(WINANSI_UNSAFE_RE.source).test(value);
}
