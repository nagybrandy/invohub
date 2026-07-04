// lib/invoices/constants.ts
// List/query defaults for fast invoice loading in the UI.
/** Default page size for invoice lists (dashboard + invoices screen). */
export const INVOICE_LIST_LIMIT = 30;

/** Hard cap to prevent accidental huge payloads. */
export const INVOICE_LIST_MAX_LIMIT = 100;
