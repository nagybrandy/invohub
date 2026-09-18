// lib/receipts/nav-error-code.ts
// Single source of truth for the stable machine codes InvoHub itself writes
// into navReceiptSubmission.errorMessage (as opposed to NAV's own verbatim
// rejection text, which passes through untranslated). Each code maps to an
// i18n key so the receipt detail screen can render it in the viewer's
// language instead of a baked-in Hungarian sentence.
export const NAV_RECEIPT_BLOCKED_REASONS = ["missing_exchange_rate"] as const;

export type NavReceiptBlockedReason = (typeof NAV_RECEIPT_BLOCKED_REASONS)[number];

const REASON_I18N_KEYS: Record<NavReceiptBlockedReason, string> = {
  missing_exchange_rate: "receipts.navMissingExchangeRate",
};

export function isNavReceiptBlockedReason(
  value: string | null | undefined
): value is NavReceiptBlockedReason {
  if (!value) return false;
  return (NAV_RECEIPT_BLOCKED_REASONS as readonly string[]).includes(value);
}

// NAV's own error text (e.g. "VALIDATION_ERROR Bad data") is untrusted,
// free-form and not one of our codes — this returns null for it, and the
// caller renders that text verbatim instead of translating it.
export function navReceiptErrorI18nKey(value: string | null | undefined): string | null {
  if (!isNavReceiptBlockedReason(value)) return null;
  return REASON_I18N_KEYS[value];
}
