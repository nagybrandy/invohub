// lib/dashboard/summary.ts
// Dashboard aggregates. computeDashboardSummary is a pure function (kept for
// tests and any caller that already has an invoice array in hand);
// getDashboardSummaryFromDb aggregates over EVERY invoice via SQL so the
// numbers are correct at scale instead of only reflecting the first page.
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoiceLineItem } from "@/db/schema";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { mapInvoiceFromDb } from "@/lib/invoices/mappers";
import { isOverdue } from "@/lib/invoices/status-visuals";
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

/**
 * Whether an invoice should count toward the dashboard's overdue bucket.
 * The reminders cron deliberately never flips a `partially_paid` invoice's
 * stored status to "overdue" — it would discard the partial-payment signal
 * (see lib/reminders/process.ts) — so relying on `status === "overdue"`
 * alone permanently hides an overdue *partial* payment from every overdue
 * total. Re-derive it from the due date for just this one status, the same
 * way the invoice detail screen already does for display (D3, isOverdue()).
 */
function isDashboardOverdue(invoice: Invoice, now: Date): boolean {
  if (invoice.status === "overdue") return true;
  return invoice.status === "partially_paid" && isOverdue(invoice, now);
}

export function computeDashboardSummary(
  invoices: Invoice[],
  now: Date = new Date(),
): DashboardSummary {
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const overdue = invoices.filter((invoice) => isDashboardOverdue(invoice, now));
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

  // Same rule as isDashboardOverdue(): status "overdue" always counts;
  // "partially_paid" counts too once its due date has passed, since the
  // reminders cron deliberately never flips that status (it would discard
  // the partial-payment signal — see lib/reminders/process.ts). Computed
  // here (not via the status-only groupRows above) because that needs the
  // due date, which a GROUP BY status can't see per invoice.
  const todayStr = now.toISOString().slice(0, 10);
  const overdueRows = await db
    .select({
      dueDate: invoice.dueDate,
      net: sql<string>`COALESCE(SUM(${invoiceLineItem.quantity} * ${invoiceLineItem.unitPrice}), 0)`,
      vat: sql<string>`COALESCE(SUM(CASE WHEN ${invoiceLineItem.vatCategory} = 'normal' THEN ${invoiceLineItem.quantity} * ${invoiceLineItem.unitPrice} * ${invoiceLineItem.vatRate} / 100.0 ELSE 0 END), 0)`,
    })
    .from(invoice)
    .leftJoin(invoiceLineItem, eq(invoiceLineItem.invoiceId, invoice.id))
    .where(
      and(
        eq(invoice.userId, userId),
        or(
          eq(invoice.status, "overdue"),
          and(
            eq(invoice.status, "partially_paid"),
            sql`substr(${invoice.dueDate}, 1, 10) < ${todayStr}`
          )
        )
      )
    )
    .groupBy(invoice.id, invoice.dueDate);

  let overdueTotal = 0;
  let oldestOverdueDays = 0;
  for (const row of overdueRows) {
    overdueTotal += Number(row.net) + Number(row.vat);
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
    overdueTotal,
    overdueCount: overdueRows.length,
    oldestOverdueDays,
    recentInvoices,
  };
}
