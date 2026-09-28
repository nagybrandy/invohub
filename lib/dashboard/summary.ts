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

/**
 * The two period KPIs used to aggregate every invoice ever, while their
 * labels promised a period: "E havi bevétel" showed all-time paid gross, and
 * "Becsült fizetendő ÁFA" showed VAT on all-time *paid* invoices under a hint
 * that names a quarter and says "a kiállított számlák alapján"
 * (docs/design/app-ux-spec-2026-09-14.md §A3 shipped that sentence and
 * deliberately left the number for later — this is later). An EV reads these
 * to judge the AAM threshold and what to set aside, so they now mean what
 * they say.
 */
export function isInSameMonth(iso: string | undefined | null, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function isInSameQuarter(iso: string | undefined | null, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (d.getFullYear() !== now.getFullYear()) return false;
  return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
}

/**
 * Whether a document carries VAT liability for the period it was issued in.
 * A draft isn't issued at all and a díjbekérő is not a tax document, so
 * neither counts. Everything else does — including a `cancelled` original,
 * because its storno document carries the offsetting negative lines; dropping
 * the original would subtract the same amount twice.
 */
export function countsTowardIssuedVat(invoice: Invoice): boolean {
  if (invoice.status === "draft" || invoice.status === "proforma") return false;
  return invoice.documentType !== "proforma";
}

function daysBetween(dueDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
}

export type DashboardSummary = {
  revenue: number;
  /** All-time paid gross — what the "Bevétel statisztika" bar sets against `outstanding`, so both sides cover the same span. */
  paidTotal: number;
  /** How many invoices make up `revenue` — the same month, so the card's count can't contradict its amount. */
  revenuePaidCount: number;
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
  const paidAllTime = invoices.filter((invoice) => invoice.status === "paid");
  const paidThisMonth = invoices.filter(
    (invoice) => invoice.status === "paid" && isInSameMonth(invoice.paidAt, now)
  );
  const vatThisQuarter = invoices.filter(
    (invoice) => countsTowardIssuedVat(invoice) && isInSameQuarter(invoice.issueDate, now)
  );
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
    revenue: paidThisMonth.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    revenuePaidCount: paidThisMonth.length,
    paidTotal: paidAllTime.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    outstanding: outstandingInvoices.reduce(
      (sum, invoice) => sum + invoiceGross(invoice),
      0,
    ),
    overdueTotal: overdue.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    issuedTotal: issued.reduce((sum, invoice) => sum + invoiceGross(invoice), 0),
    estimatedVat: vatThisQuarter.reduce((sum, invoice) => sum + invoiceVat(invoice), 0),
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
): Pick<DashboardSummary, "paidTotal" | "outstanding" | "overdueTotal" | "issuedTotal"> {
  let paidTotal = 0;
  let outstanding = 0;
  let overdueTotal = 0;
  let issuedTotal = 0;

  for (const row of rows) {
    const gross = row.net + row.vat;
    if (row.status === "paid") {
      paidTotal += gross;
    } else if (OUTSTANDING_STATUSES.includes(row.status)) {
      outstanding += gross;
      if (row.status === "overdue") {
        overdueTotal += gross;
      }
    } else if (ISSUED_STATUSES.includes(row.status)) {
      issuedTotal += gross;
    }
  }

  // revenue and estimatedVat are period-bounded and therefore cannot come
  // from a GROUP BY status — getDashboardSummaryFromDb queries them separately.
  return { paidTotal, outstanding, overdueTotal, issuedTotal };
}

/** First day of `now`'s month and of the next one, as timestamps for a half-open range. */
export function monthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** First and last day of `now`'s quarter as YYYY-MM-DD, for the text issue_date column. */
export function quarterRangeIso(now: Date): { start: string; end: string } {
  const firstMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(now.getUTCFullYear(), firstMonth, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), firstMonth + 3, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
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

  // The two period KPIs need their own filters: a GROUP BY status can see
  // neither the payment date nor the issue date. "E havi bevétel" is what was
  // actually paid this calendar month; the VAT estimate follows issuance (the
  // basis the dashboard hint states), so an issued-but-unpaid invoice counts
  // and a draft or díjbekérő never does.
  const { start: monthStart, end: monthEnd } = monthRange(now);
  const [revenueRow] = await db
    .select({
      gross: sql<string>`COALESCE(SUM(${invoiceLineItem.quantity} * ${invoiceLineItem.unitPrice} * (1 + CASE WHEN ${invoiceLineItem.vatCategory} = 'normal' THEN ${invoiceLineItem.vatRate} / 100.0 ELSE 0 END)), 0)`,
      count: sql<string>`COUNT(DISTINCT ${invoice.id})`,
    })
    .from(invoice)
    .leftJoin(invoiceLineItem, eq(invoiceLineItem.invoiceId, invoice.id))
    .where(
      and(
        eq(invoice.userId, userId),
        eq(invoice.status, "paid"),
        sql`${invoice.paidAt} >= ${monthStart} AND ${invoice.paidAt} < ${monthEnd}`
      )
    );

  const { start: quarterStart, end: quarterEnd } = quarterRangeIso(now);
  const [vatRow] = await db
    .select({
      vat: sql<string>`COALESCE(SUM(CASE WHEN ${invoiceLineItem.vatCategory} = 'normal' THEN ${invoiceLineItem.quantity} * ${invoiceLineItem.unitPrice} * ${invoiceLineItem.vatRate} / 100.0 ELSE 0 END), 0)`,
    })
    .from(invoice)
    .leftJoin(invoiceLineItem, eq(invoiceLineItem.invoiceId, invoice.id))
    .where(
      and(
        eq(invoice.userId, userId),
        sql`${invoice.status} NOT IN ('draft', 'proforma')`,
        sql`${invoice.documentType} <> 'proforma'`,
        sql`substr(${invoice.issueDate}, 1, 10) >= ${quarterStart}`,
        sql`substr(${invoice.issueDate}, 1, 10) <= ${quarterEnd}`
      )
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
    revenue: Number(revenueRow?.gross ?? 0),
    revenuePaidCount: Number(revenueRow?.count ?? 0),
    estimatedVat: Number(vatRow?.vat ?? 0),
    overdueTotal,
    overdueCount: overdueRows.length,
    oldestOverdueDays,
    recentInvoices,
  };
}
