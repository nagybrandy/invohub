// lib/dashboard/summary.ts
// Pure dashboard invoice aggregates: paid / issued / outstanding / overdue / VAT estimate.
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";

export type DashboardSummary = {
  /** Gross total of paid invoices (primary revenue figure). */
  paid: number;
  /** Gross total of draft + proforma (not yet receivables). */
  issued: number;
  /** Gross total of sent + overdue (open receivables). */
  outstanding: number;
  /** Gross total of overdue invoices only. */
  overdue: number;
  overdueCount: number;
  /** Oldest overdue age in whole days (0 when none). */
  oldestOverdueDays: number;
  /**
   * Estimated VAT from paid invoice line items (sum of vatTotal).
   * Not a NAV filing amount — an in-app estimate only.
   */
  estimatedVat: number;
  recentInvoices: Invoice[];
};

function invoiceGross(invoice: Invoice): number {
  return calculateInvoiceTotals(invoice.lineItems).totalAmount;
}

function invoiceVat(invoice: Invoice): number {
  return calculateInvoiceTotals(invoice.lineItems).vatTotal;
}

function daysPastDue(dueDate: string, now: Date): number {
  const ms = now.getTime() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function computeDashboardSummary(
  invoices: Invoice[],
  now: Date = new Date()
): DashboardSummary {
  let paid = 0;
  let issued = 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  let oldestOverdueDays = 0;
  let estimatedVat = 0;

  for (const inv of invoices) {
    const gross = invoiceGross(inv);

    switch (inv.status) {
      case "paid":
        paid += gross;
        estimatedVat += invoiceVat(inv);
        break;
      case "draft":
      case "proforma":
        issued += gross;
        break;
      case "sent":
        outstanding += gross;
        break;
      case "overdue":
        outstanding += gross;
        overdue += gross;
        overdueCount += 1;
        oldestOverdueDays = Math.max(
          oldestOverdueDays,
          daysPastDue(inv.dueDate, now)
        );
        break;
      case "cancelled":
        break;
      default: {
        const _exhaustive: never = inv.status;
        void _exhaustive;
        break;
      }
    }
  }

  const recentInvoices = [...invoices]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return {
    paid,
    issued,
    outstanding,
    overdue,
    overdueCount,
    oldestOverdueDays,
    estimatedVat,
    recentInvoices,
  };
}
