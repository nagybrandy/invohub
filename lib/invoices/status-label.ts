// lib/invoices/status-label.ts
// Shared invoice status i18n keys and badge color classes (green = paid only).
import type { InvoiceStatus } from "@/lib/invoices/types";

export function invoiceStatusI18nKey(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "invoices.status.paid";
    case "overdue":
      return "invoices.status.overdue";
    case "sent":
      return "invoices.status.sent";
    case "draft":
      return "invoices.status.draft";
    case "proforma":
      return "invoices.status.proforma";
    case "cancelled":
      return "invoices.status.cancelled";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Badge/border classes — cornflower/navy brand; green only for paid/success. */
export function invoiceStatusColorClass(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "border-green-500 text-green-700";
    case "overdue":
      return "border-red-500 text-red-600";
    case "sent":
      return "border-primary text-primary";
    case "draft":
      return "border-muted-foreground text-muted-foreground";
    case "proforma":
      return "border-orange-500 text-orange-600";
    case "cancelled":
      return "border-muted-foreground/50 text-muted-foreground/50";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
