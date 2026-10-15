// lib/nav/bank-account.ts
// NAV OSA 3.0 BankAccountNumberType accepts exactly three shapes:
//   [0-9]{8}-[0-9]{8}-[0-9]{8} | [0-9]{8}-[0-9]{8} | IBAN ([A-Z]{2}[0-9]{2}[0-9A-Za-z]{11,30})
// A company typing "11742180 21462016 00000000" or the digits without hyphens
// (what the first live submission carried) is rejected with cvc-pattern-valid
// and the whole invoice with it. Normalize what can be normalized; omit the
// element rather than send something the schema refuses (it is optional).
const NAV_BANK_ACCOUNT_PATTERN = /^(?:[0-9]{8}-[0-9]{8}-[0-9]{8}|[0-9]{8}-[0-9]{8}|[A-Z]{2}[0-9]{2}[0-9A-Za-z]{11,30})$/;

export function isNavBankAccountNumber(value: string): boolean {
  return NAV_BANK_ACCOUNT_PATTERN.test(value);
}

/** The schema-valid form of a stored account number, or null when none can be made. */
export function formatNavBankAccountNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[\s-]/g, "");
  if (/^[0-9]{24}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 16)}-${compact.slice(16, 24)}`;
  }
  if (/^[0-9]{16}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 16)}`;
  }
  if (/^[A-Za-z]{2}[0-9]{2}[0-9A-Za-z]{11,30}$/.test(compact)) {
    return compact.slice(0, 2).toUpperCase() + compact.slice(2);
  }
  return isNavBankAccountNumber(raw.trim()) ? raw.trim() : null;
}
