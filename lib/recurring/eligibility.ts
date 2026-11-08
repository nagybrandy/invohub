// lib/recurring/eligibility.ts
// Which documents may be saved as a recurring template: a regular invoice,
// issued or still a draft — not a díjbekérő, stornó or helyesbítő, and not a
// cancelled one. Pure; the detail screen and the service share the rule.
import type { Invoice } from "@/lib/invoices/types";

export function canSaveAsRecurring(invoice: Pick<Invoice, "documentType" | "status">): boolean {
  return invoice.documentType === "invoice" && invoice.status !== "cancelled";
}
