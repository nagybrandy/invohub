// components/marketing/sample-data.ts
// Illustrative sample data for the landing's product miniature and the invoice
// capability card. Always shown next to `landing.product.sampleData`
// ("Termékelőnézet · mintaadatok"), never presented as real records.
import type { InvoiceStatus } from "@/lib/invoices/types";

export type SampleStatus = Extract<InvoiceStatus, "paid" | "sent" | "draft">;

export type SampleInvoice = {
  id: string;
  client: string;
  amount: string;
  status: SampleStatus;
};

export const SAMPLE_INVOICES: readonly SampleInvoice[] = [
  { id: "INV-2026-0142", client: "Minta Stúdió Kft.", amount: "248 920 Ft", status: "paid" },
  { id: "INV-2026-0141", client: "Kék Duna Bt.", amount: "86 400 Ft", status: "sent" },
  { id: "INV-2026-0140", client: "Northwind Kft.", amount: "174 600 Ft", status: "draft" },
];

/** The three KPI cells of the miniature (current period = paid + sent). */
export const SAMPLE_KPIS = {
  period: "1 284 500 Ft",
  paid: "912 300 Ft",
  sent: "372 200 Ft",
} as const;
