// lib/nav/invoice-fields.ts
// Pure scalar mappers from InvoHub invoice values to NAV OSA 3.0 InvoiceData
// field values. No I/O, no i18next — just the verified-against-XSD mapping
// knowledge, kept in one testable place (mirrors the invoiceReference work
// in lib/nav/invoice-xml.ts).
//
// Verified against the public schema at nav-gov-hu/Online-Invoice, fetched
// 2026-09-15:
//  - base:PaymentMethodType (src/schemas/nav/gov/hu/OSA/invoiceBase.xsd,
//    lines 127-164) — exactly five enum values: TRANSFER, CASH, CARD,
//    VOUCHER, OTHER. InvoHub's PaymentMethod union (lib/invoices/types.ts)
//    has no VOUCHER counterpart (see docs/plans/
//    2026-09-15-nav-xml-payment-method-date.md §2b).
//  - base:InvoiceDateType (invoiceBase.xsd lines 68-77) — xs:date,
//    minInclusive 2010-01-01, pattern \d{4}-\d{2}-\d{2}.
import { PAYMENT_METHODS } from "@/lib/invoices/payment-status";
import type { PaymentMethod } from "@/lib/invoices/types";

export type NavPaymentMethod = "TRANSFER" | "CASH" | "CARD" | "OTHER" | "VOUCHER";

// Table-driven over PAYMENT_METHODS so a future added InvoHub payment
// method fails invoice-fields.test.ts (AC2) until it's mapped here.
const NAV_PAYMENT_METHOD: Record<PaymentMethod, NavPaymentMethod> = {
  transfer: "TRANSFER",
  cash: "CASH",
  card: "CARD",
  other: "OTHER",
};

/**
 * Maps an InvoHub payment method to NAV's PaymentMethodType enum value.
 * - undefined/null/blank -> null: caller omits the optional <paymentMethod>
 *   element (§2c — omitting rather than asserting OTHER for "we don't know").
 * - Any other non-empty value that isn't one of the four known InvoHub
 *   methods (only reachable through DB drift) -> "OTHER". Never a literal
 *   outside the five-member NAV enum.
 */
export function toNavPaymentMethod(value: string | null | undefined): NavPaymentMethod | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if ((PAYMENT_METHODS as string[]).includes(trimmed)) {
    return NAV_PAYMENT_METHOD[trimmed as PaymentMethod];
  }
  return "OTHER";
}

const NAV_DATE_MIN = "2010-01-01";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalizes an InvoHub date/timestamp string to base:InvoiceDateType's
 * shape (xs:date, minInclusive 2010-01-01): the first 10 characters, if
 * they form a real calendar date on/after 2010-01-01. Returns null for
 * anything that can't be normalized to a valid NAV date (blank, not
 * date-shaped, an impossible calendar date, or before the XSD's lower
 * bound) — callers decide whether to omit the element or fall back.
 */
export function toNavDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  if (!DATE_ONLY_RE.test(datePart)) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!isRealCalendarDate) return null;

  if (datePart < NAV_DATE_MIN) return null;

  return datePart;
}
