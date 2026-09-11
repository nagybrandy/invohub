// lib/invoices/service.ts
// Server-side invoice CRUD against Neon via Drizzle.
import { and, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoiceLineItem } from "@/db/schema";
import { createId } from "@/lib/id";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import {
  INVOICE_LIST_LIMIT,
  INVOICE_LIST_MAX_LIMIT,
} from "@/lib/invoices/constants";
import {
  mapInvoiceFromDb,
  mapLineItemFromDb,
  mapInvoiceToDb,
  mapLineItemToDb,
} from "@/lib/invoices/mappers";
import type { InvoiceListFilters } from "@/lib/invoices/list-query";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";

export type InvoiceListOptions = {
  limit?: number;
  offset?: number;
} & InvoiceListFilters;

export type InvoiceListResult = {
  invoices: Invoice[];
  total: number;
  limit: number;
  offset: number;
};

export type InvoiceStats = {
  count: number;
  thisMonthCount: number;
  monthlyTotal: number;
};

function clampLimit(limit: number | undefined): number {
  const value = limit ?? INVOICE_LIST_LIMIT;
  return Math.min(Math.max(1, value), INVOICE_LIST_MAX_LIMIT);
}

function buildListWhere(userId: string, options: InvoiceListOptions) {
  const clauses = [eq(invoice.userId, userId)];

  if (options.status) {
    clauses.push(eq(invoice.status, options.status));
  }

  const search = options.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    clauses.push(
      or(
        ilike(invoice.clientName, pattern),
        ilike(invoice.invoiceNumber, pattern),
        ilike(invoice.clientTaxNumber, pattern),
      )!,
    );
  }

  return and(...clauses);
}

async function loadLineItemsForInvoices(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return new Map<string, typeof invoiceLineItem.$inferSelect[]>();

  const rows = await db
    .select()
    .from(invoiceLineItem)
    .where(inArray(invoiceLineItem.invoiceId, invoiceIds));

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.invoiceId) ?? [];
    list.push(row);
    grouped.set(row.invoiceId, list);
  }
  return grouped;
}

export async function countInvoices(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(invoice)
    .where(eq(invoice.userId, userId));
  return row?.value ?? 0;
}

export async function getInvoiceStats(userId: string): Promise<InvoiceStats> {
  const total = await countInvoices(userId);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = nextMonth.toISOString().slice(0, 10);

  const monthRows = await db
    .select()
    .from(invoice)
    .where(
      and(
        eq(invoice.userId, userId),
        gte(invoice.issueDate, monthStart),
        lt(invoice.issueDate, monthEnd)
      )
    );

  const itemsByInvoice = await loadLineItemsForInvoices(monthRows.map((row) => row.id));
  let monthlyTotal = 0;

  for (const row of monthRows) {
    const items = itemsByInvoice.get(row.id) ?? [];
    monthlyTotal += calculateInvoiceTotals(items.map(mapLineItemFromDb)).totalAmount;
  }

  return {
    count: total,
    thisMonthCount: monthRows.length,
    monthlyTotal,
  };
}

export async function listInvoices(
  userId: string,
  options: InvoiceListOptions = {}
): Promise<InvoiceListResult> {
  const limit = clampLimit(options.limit);
  const offset = Math.max(0, options.offset ?? 0);
  const where = buildListWhere(userId, options);

  const [totalRow, rows] = await Promise.all([
    db.select({ value: count() }).from(invoice).where(where),
    db
      .select()
      .from(invoice)
      .where(where)
      .orderBy(desc(invoice.issueDate))
      .limit(limit)
      .offset(offset),
  ]);

  const itemsByInvoice = await loadLineItemsForInvoices(rows.map((row) => row.id));
  const invoices = rows.map((row) =>
    mapInvoiceFromDb(row, itemsByInvoice.get(row.id) ?? [])
  );

  return {
    invoices,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  };
}

/** @deprecated Prefer listInvoices — kept for callers that need every row. */
export async function listAllInvoices(userId: string): Promise<Invoice[]> {
  const { invoices } = await listInvoices(userId, {
    limit: INVOICE_LIST_MAX_LIMIT,
    offset: 0,
  });
  return invoices;
}

async function loadLineItems(invoiceId: string) {
  return db
    .select()
    .from(invoiceLineItem)
    .where(eq(invoiceLineItem.invoiceId, invoiceId));
}

export async function getInvoiceById(
  userId: string,
  id: string
): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.id, id), eq(invoice.userId, userId)));

  if (!row) return null;
  const items = await loadLineItems(row.id);
  return mapInvoiceFromDb(row, items);
}

export async function upsertInvoice(
  userId: string,
  data: Invoice
): Promise<Invoice> {
  const now = new Date();
  const existing = await getInvoiceById(userId, data.id);
  const row = mapInvoiceToDb(
    {
      ...data,
      createdAt: existing?.createdAt ?? data.createdAt,
      updatedAt: now.toISOString(),
    },
    userId
  );

  if (existing) {
    await db.update(invoice).set({ ...row, updatedAt: now }).where(eq(invoice.id, data.id));
    await db.delete(invoiceLineItem).where(eq(invoiceLineItem.invoiceId, data.id));
  } else {
    await db.insert(invoice).values({
      ...row,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (data.lineItems.length > 0) {
    await db.insert(invoiceLineItem).values(
      data.lineItems.map((item, index) => ({
        ...mapLineItemToDb(item, data.id, index),
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  const saved = await getInvoiceById(userId, data.id);
  if (!saved) throw new Error("Failed to save invoice.");
  return saved;
}

export async function deleteInvoiceById(
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getInvoiceById(userId, id);
  if (!existing) return false;
  await db
    .delete(invoice)
    .where(and(eq(invoice.id, id), eq(invoice.userId, userId)));
  return true;
}

export function duplicateInvoice(source: Invoice): Invoice {
  const now = new Date().toISOString();
  return {
    ...source,
    id: createId(),
    invoiceNumber: `${source.invoiceNumber}-COPY`,
    status: "draft",
    lineItems: source.lineItems.map((item) => ({
      ...item,
      id: createId(),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function stornoInvoice(source: Invoice): Invoice {
  const now = new Date().toISOString();
  const negatedItems: InvoiceLineItem[] = source.lineItems.map((item) => ({
    ...item,
    id: createId(),
    quantity: -Math.abs(item.quantity),
  }));
  return {
    ...source,
    id: createId(),
    invoiceNumber: `${source.invoiceNumber}-STORNO`,
    status: "cancelled",
    lineItems: negatedItems,
    notes: `Storno of ${source.invoiceNumber}`,
    createdAt: now,
    updatedAt: now,
  };
}
