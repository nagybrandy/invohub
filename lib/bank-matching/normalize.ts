// lib/bank-matching/normalize.ts
// Normalize party names and remittance text for deterministic matching.

const COMPANY_SUFFIXES =
  /\b(kft|zrt|bt|nyrt|ev|e\.?\s*v\.?|kkt|ltd|llc|inc|gmbh|srl)\b/gi;

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Lowercase, strip accents/punctuation/company suffixes for comparison. */
export function normalizePartyName(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Spaced tokens for display/search; use `compactRemittance` for invoice refs. */
export function normalizeRemittance(text: string): string {
  return stripDiacritics(text)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Remittance with separators removed so invoice numbers match mid-string. */
export function compactRemittance(text: string): string {
  return stripDiacritics(text)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeInvoiceNumber(invoiceNumber: string): string {
  return stripDiacritics(invoiceNumber)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
