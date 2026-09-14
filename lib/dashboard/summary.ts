// lib/dashboard/summary.ts
// Dashboard aggregates. computeDashboardSummary is a pure function (kept for
// tests and any caller that already has an invoice array in hand);
// getDashboardSummaryFromDb aggregates over EVERY invoice via SQL so the
// numbers are correct at scale instead of only reflecting the first page.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoiceLineItem } from "@/db/schema";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { mapInvoiceFromDb } from "@/lib/invoices/mappers";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

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

const OUTSTANDING_STATUSES: InvoiceStatus[] = ["sent", "overdue", "partially_paid", "unpaid"];
const ISSUED_STATUSES: InvoiceStatus[] = ["draft", "proforma"];

export function computeDashboardSummary(
  invoices: Invoice[],
  now: Date = new Date(),
): DashboardSummary {
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");
  const outstandingInvoices = invoices.filter((invoice) =>
    OUTSTANDING_STATUSES.includes(invoice.status),
  );
  const issued = invoices.filter((invoice) => ISSUED_STATUSES.includes(invoice.status));

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

export type StatusTotalsRow = { status: InvoiceStatus; net: number; vat: number };

/** Pure fold of one SQL GROUP BY status row per status into the dashboard buckets. */
export function aggregateStatusTotals(
  rows: StatusTotalsRow[],
): Pick<DashboardSummary, "revenue" | "outstanding" | "overdueTotal" | "issuedTotal" | "estimatedVat"> {
  let revenue = 0;
  let outstanding = 0;
  let overdueTotal = 0;
  let issuedTotal = 0;
  let estimatedVat = 0;

  for (const row of rows) {
    const gross = row.net + row.vat;
    if (row.status === "paid") {
      revenue += gross;
      estimatedVat += row.vat;
    } else if (OUTSTANDING_STATUSES.includes(row.status)) {
      outstanding += gross;
      if (row.status === "overdue") {
        overdueTotal += gross;
      }
    } else if (ISSUED_STATUSES.includes(row.status)) {
      issuedTotal += gross;
    }
  }

  return { revenue, outstanding, overdueTotal, issuedTotal, estimatedVat };
}

/**
 * Aggregates over ALL of the user's invoices with SQL (SUM/GROUP BY status),
 * not just the first page — replaces the previous client-side reduce over
 * whatever the invoice list screen happened to have loaded.
 */
export async function getDashboardSummaryFromDb(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardSummary> {
  const groupRows = await db
    .select({
      status: invoice.status,
      net: sql<string>`COALESCE(SUM(${invoiceLineItem.quantity} * ${invoiceLineItem.unitPrice}), 0)`,
      vat: sql<string>`COALESCE(SUM(CASE WHEN ${invoiceLineItem.vatCategory} = 'normal' THEN ${invoiceLineItem.quantity} * ${invoiceLineItem.unitPrice} * ${invoiceLineItem.vatRate} / 100.0 ELSE 0 END), 0)`,
    })
    .from(invoice)
    .leftJoin(invoiceLineItem, eq(invoiceLineItem.invoiceId, invoice.id))
    .where(eq(invoice.userId, userId))
    .groupBy(invoice.status);

  const totals = aggregateStatusTotals(
    groupRows.map((row) => ({
      status: row.status as InvoiceStatus,
      net: Number(row.net),
      vat: Number(row.vat),
    })),
  );

  const overdueRows = await db
    .select({ dueDate: invoice.dueDate })
    .from(invoice)
    .where(and(eq(invoice.userId, userId), eq(invoice.status, "overdue")));

  let oldestOverdueDays = 0;
  for (const row of overdueRows) {
    const days = daysBetween(row.dueDate, now);
    if (days > oldestOverdueDays) {
      oldestOverdueDays = days;
    }
  }

  const recentRows = await db
    .select()
    .from(invoice)
    .where(eq(invoice.userId, userId))
    .orderBy(desc(invoice.createdAt))
    .limit(5);

  const recentIds = recentRows.map((row) => row.id);
  const recentLineItems = recentIds.length
    ? await db.select().from(invoiceLineItem).where(inArray(invoiceLineItem.invoiceId, recentIds))
    : [];
  const itemsByInvoice = new Map<string, typeof recentLineItems>();
  for (const item of recentLineItems) {
    const list = itemsByInvoice.get(item.invoiceId) ?? [];
    list.push(item);
    itemsByInvoice.set(item.invoiceId, list);
  }
  const recentInvoices = recentRows.map((row) =>
    mapInvoiceFromDb(row, itemsByInvoice.get(row.id) ?? []),
  );

  return {
    ...totals,
    overdueCount: overdueRows.length,
    oldestOverdueDays,
    recentInvoices,
  };
}
