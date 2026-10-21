// lib/bulk/template.ts
// The downloadable example file: a header row, then one example per document
// kind so the format explains itself.
import { BULK_COLUMNS, type BulkColumn } from "@/lib/bulk/columns";
import { buildCsv } from "@/lib/export/csv";

const EXAMPLES: Array<Partial<Record<BulkColumn, string>>> = [
  {
    type: "invoice", partner_name: "Minta Partner Kft.", partner_tax_number: "12345678-2-41", partner_email: "szamla@minta.hu",
    partner_country: "HU", partner_zip: "1051", partner_city: "Budapest", partner_address: "Nádor utca 1.",
    issue_date: "2026-11-02", fulfillment_date: "2026-11-02", due_date: "2026-11-10", currency: "HUF", payment_method: "transfer",
    language: "hu", description: "Havi karbantartás – 2026. november", comment: "Szerződés: KARB-2026", quantity: "1", unit: "hó",
    unit_price: "45000", price_type: "net", vat_rate: "27", note: "Köszönjük!",
  },
  {
    type: "proforma", partner_name: "Example Ltd.", partner_email: "billing@example.co.uk", partner_country: "GB",
    partner_zip: "EC1A 1BB", partner_city: "London", partner_address: "1 Example Street",
    issue_date: "2026-11-02", due_date: "2026-11-16", currency: "EUR", payment_method: "transfer", language: "en",
    description: "Consulting day", quantity: "2", unit: "day", unit_price: "350", price_type: "net", vat_rate: "27",
  },
  {
    type: "receipt", currency: "HUF", payment_method: "cash", language: "hu", description: "Konzultáció", quantity: "1",
    unit: "óra", unit_price: "15000", price_type: "gross", vat_rate: "27",
  },
];

export function bulkTemplateCsv(): string {
  return buildCsv(
    [...BULK_COLUMNS],
    EXAMPLES.map((example) => BULK_COLUMNS.map((column) => example[column] ?? "")),
  );
}

export const BULK_TEMPLATE_FILENAME = "invohub-tomeges-feltoltes-minta.csv";
