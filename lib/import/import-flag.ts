// lib/import/import-flag.ts
// The spreadsheet import is behind a flag: it re-issues historical rows as
// new EUR drafts (IMPORT-1, …) and those drafts are what the invoice list's
// red exchange-rate banner is about. Off by default everywhere; a deploy
// that wants it sets EXPO_PUBLIC_ENABLE_INVOICE_IMPORT=true. The same
// variable gates the API route and the UI entry points, so neither can be
// on without the other. See docs/decisions/2026-09-28-invoice-import-behind-flag.md.
export function isInvoiceImportEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.EXPO_PUBLIC_ENABLE_INVOICE_IMPORT === "true";
}
