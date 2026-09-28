// lib/invoices/list-actions.ts
// Which row actions the invoice list may offer. Mirrors the server: DELETE
// /api/invoices/[id] goes through deleteDraftInvoiceById and answers 409 for
// anything but a draft, so the menu must not offer what the server refuses.
import type { Invoice } from "@/lib/invoices/types";

export function canDeleteFromList(invoice: Pick<Invoice, "status">): boolean {
  return invoice.status === "draft";
}
