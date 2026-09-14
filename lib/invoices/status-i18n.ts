// lib/invoices/status-i18n.ts
// Shared i18n key + badge-variant lookups for InvoiceStatus, used by the
// invoice list, invoice card, and invoice detail screens so they never
// drift out of sync with each other.
import type { InvoiceStatus } from "@/lib/invoices/types";

export const STATUS_I18N_KEY: Record<InvoiceStatus, string> = {
  draft: "invoices.status.draft",
  proforma: "invoices.proforma",
  sent: "invoices.status.sent",
  paid: "invoices.status.paid",
  partially_paid: "invoices.status.partiallyPaid",
  unpaid: "invoices.status.unpaid",
  overdue: "invoices.status.overdue",
  cancelled: "invoices.status.cancelled",
};

export const STATUS_BADGE_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  proforma: "outline",
  sent: "default",
  paid: "outline",
  partially_paid: "outline",
  unpaid: "secondary",
  overdue: "destructive",
  cancelled: "destructive",
};
