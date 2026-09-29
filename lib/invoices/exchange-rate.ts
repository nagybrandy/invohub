// lib/invoices/exchange-rate.ts
// Pure HUF exchange-rate resolution/formatting for non-HUF invoices. No I/O,
// no i18next — shared by the NAV XML builder (lib/nav/invoice-xml.ts), the
// document renderer (generate-pdf.ts) and the composer
// (components/invoices/composer/composer-logic.ts) alike.
//
// The rate itself is whatever the user typed on the invoice — this module
// does not fetch, validate against, or guess an MNB/ECB rate; see plan
// docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md OQ-1.
import type { Invoice, InvoiceCurrency } from "@/lib/invoices/types";

/** Only a non-HUF invoice needs a manual HUF exchange rate. */
export function requiresExchangeRate(currency: InvoiceCurrency): boolean {
  return currency !== "HUF";
}

/**
 * Parses a user-typed exchange rate. Accepts both a comma decimal separator
 * ("390,5" — what a Hungarian phone keyboard offers) and a dot ("390.5").
 * Returns null for blank, non-numeric, zero or negative input — never NaN,
 * never a non-positive number.
 */
export function parseExchangeRateInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export type ExchangeRateResolution =
  | { ok: true; rate: number }
  | { ok: false; reason: "missing" | "invalid" };

/**
 * Resolves the HUF exchange rate to use for an invoice. A HUF invoice
 * always resolves to rate 1 — a stale rate left over on the row (e.g. after
 * switching the currency back to HUF) is ignored, never applied. A non-HUF
 * invoice needs a positive, finite stored rate; missing vs. non-positive are
 * reported as distinct reasons so callers can word the error appropriately.
 */
export function resolveExchangeRate(
  invoice: Pick<Invoice, "currency" | "exchangeRate">
): ExchangeRateResolution {
  if (!requiresExchangeRate(invoice.currency)) return { ok: true, rate: 1 };

  const rate = invoice.exchangeRate;
  if (rate === undefined || rate === null) return { ok: false, reason: "missing" };
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false, reason: "invalid" };
  return { ok: true, rate };
}

/**
 * True when an invoice can't be reported to NAV because it's non-HUF and
 * has no usable stored rate — the same condition `buildNavInvoiceXml`
 * refuses on (via `resolveExchangeRate`). A HUF invoice is never
 * "affected": it always resolves to rate 1 regardless of what's stored.
 */
export function isMissingExchangeRate(
  invoice: Pick<Invoice, "currency" | "exchangeRate">
): boolean {
  return !resolveExchangeRate(invoice).ok;
}

/** Converts a document-currency amount to HUF at the given rate, rounded to 2 decimals. */
export function toHufAmount(amount: number, rate: number): number {
  // Round half away from zero, symmetric around 0: a reversing (negative)
  // line must convert to exactly minus its original's HUF amount — plain
  // Math.round rounds -x.5 towards +∞ and would leave a 0.01 HUF residue
  // between a helyesbítő's reversal and its original line.
  const cents = Math.round(Math.abs(amount * rate) * 100) / 100;
  return amount * rate < 0 ? -cents : cents;
}

/**
 * Formats a rate for the NAV XML's <exchangeRate> element: up to 6 decimal
 * places, trailing zeros trimmed, "." as the decimal separator regardless of
 * locale (this is XML content, not a UI display string).
 */
export function formatExchangeRate(rate: number): string {
  return rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
