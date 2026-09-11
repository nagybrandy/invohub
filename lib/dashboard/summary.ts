// lib/dashboard/summary.ts
// Pure dashboard aggregates so metrics stay testable without mounting the screen.
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";

function invoiceGross(invoice: Invoice): number {
  return calculateInvoiceTotals(invoice.lineItems).totalAmount;
}

function invoiceVat(invoice: Invoice): number {
  return calculateInvoiceTotals(invoice.lineItems).vatTotal;
}

function daysBetween(dueDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
}

export type DashboardSummary = {
  revenue: number;
  outstanding: number;
  overdueTotal: number;
  issuedTotal: number;
  estimatedVat: number;
  overdueCount: number;
  oldestOverdueDays: number;
  recentInvoices: Invoice[];
};

export function computeDashboardSummary(
  invoices: Invoice[],
  now: Date = new Date(),
): DashboardSummary {
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");
  const outstandingInvoices = invoices.filter(
    (invoice) => invoice.status === "sent" || invoice.status === "overdue",
  );
  const issued = invoices.filter(
    (invoice) => invoice.status === "draft" || invoice.status === "proforma",
  );

  let oldestOverdueDays = 0;
  for (const invoice of overdue) {
    const days = daysBetween(invoice.dueDate, now);
    if (days > oldestOverdueDays) {
      oldestOverdueDays = days;
    }
  }

  return {
    revenue: paid.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    outstanding: outstandingInvoices.reduce(
      (sum, invoice) => sum + invoiceGross(invoice),
      0,
    ),
    overdueTotal: overdue.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    issuedTotal: issued.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    estimatedVat: paid.reduce((sum, invoice) => sum + invoiceVat(invoice), 0),
    overdueCount: overdue.length,
    oldestOverdueDays,
    recentInvoices: [...invoices]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  };
}
