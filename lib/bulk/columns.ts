// lib/bulk/columns.ts
// The bulk-upload file: ONE ROW = ONE DOCUMENT with ONE line item (the
// monthly-subscription / flat-fee case), flat column names in the style of
// Stripe/Shopify CSV exports. No multi-row documents: the Számlázz.hu import
// format repeats header columns across several rows per invoice, which is
// unmanageable by hand — an invoice with several lines is made in the app.
export const BULK_COLUMNS = [
  "type",
  "partner_name",
  "partner_tax_number",
  "partner_email",
  "partner_country",
  "partner_zip",
  "partner_city",
  "partner_address",
  "issue_date",
  "fulfillment_date",
  "due_date",
  "currency",
  "exchange_rate",
  "payment_method",
  "language",
  "description",
  "comment",
  "quantity",
  "unit",
  "unit_price",
  "price_type",
  "vat_rate",
  "note",
] as const;

export type BulkColumn = (typeof BULK_COLUMNS)[number];

export const BULK_DOCUMENT_TYPES = ["invoice", "proforma", "advance", "receipt"] as const;
export type BulkDocumentType = (typeof BULK_DOCUMENT_TYPES)[number];

/** Hard cap per upload — keeps the preview and the sequential creation sane. */
export const BULK_MAX_ROWS = 200;
