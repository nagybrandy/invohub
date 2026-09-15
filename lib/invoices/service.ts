// lib/invoices/service.ts
// Server-side invoice CRUD against Neon via Drizzle.
import { and, count, desc, eq, gte, ilike, inArray, lt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoiceLineItem } from "@/db/schema";
import { createId } from "@/lib/id";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { buildInvoiceFromProforma } from "@/lib/invoices/convert-proforma";
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
import { generateNextInvoiceNumber } from "@/lib/invoices/numbering";
import { deriveInvoiceStatusFromPayment } from "@/lib/invoices/payment-status";
import type { InvoiceListFilters } from "@/lib/invoices/list-query";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceDocumentType,
  PaymentMethod,
} from "@/lib/invoices/types";
import { hasInvoiceNumber } from "@/lib/invoices/types";

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

/**
 * Fetches every invoice with issueDate in [from, to] by paginating the SQL
 * query (date range pushed into WHERE, not filtered in JS afterwards), so
 * exports are never silently truncated at the list page cap.
 */
export async function listInvoicesInDateRange(
  userId: string,
  from: string,
  to: string
): Promise<Invoice[]> {
  const where = and(
    eq(invoice.userId, userId),
    gte(invoice.issueDate, from),
    lte(invoice.issueDate, to)
  );

  const pageSize = 500;
  const all: Invoice[] = [];
  let offset = 0;

  for (;;) {
    const rows = await db
      .select()
      .from(invoice)
      .where(where)
      .orderBy(desc(invoice.issueDate))
      .limit(pageSize)
      .offset(offset);

    if (rows.length === 0) break;

    const itemsByInvoice = await loadLineItemsForInvoices(rows.map((row) => row.id));
    for (const row of rows) {
      all.push(mapInvoiceFromDb(row, itemsByInvoice.get(row.id) ?? []));
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return all;
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

function issueYearOf(isoDate: string): number {
  const year = new Date(isoDate).getFullYear();
  return Number.isNaN(year) ? new Date().getFullYear() : year;
}

/**
 * Numbers are assigned at finalize time: a draft keeps invoiceNumber == "" so
 * duplicating/editing it never burns a sequence slot. The moment status
 * moves off "draft", allocate the next number atomically (see
 * lib/invoices/numbering.ts) unless one is already set.
 */
async function assignInvoiceNumberIfNeeded(
  userId: string,
  data: Invoice
): Promise<Invoice> {
  if (data.status === "draft" || hasInvoiceNumber(data)) {
    return data;
  }
  const invoiceNumber = await generateNextInvoiceNumber(
    userId,
    data.documentType,
    issueYearOf(data.issueDate)
  );
  return { ...data, invoiceNumber };
}

export async function upsertInvoice(
  userId: string,
  data: Invoice
): Promise<Invoice> {
  const now = new Date();
  const existing = await getInvoiceById(userId, data.id);
  const withNumber = await assignInvoiceNumberIfNeeded(userId, data);
  const row = mapInvoiceToDb(
    {
      ...withNumber,
      createdAt: existing?.createdAt ?? withNumber.createdAt,
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

  if (withNumber.lineItems.length > 0) {
    await db.insert(invoiceLineItem).values(
      withNumber.lineItems.map((item, index) => ({
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

/** Draft copy with a blank number — it only gets one once finalized (never "-COPY"). */
export function duplicateInvoice(source: Invoice): Invoice {
  const now = new Date().toISOString();
  const docType: InvoiceDocumentType =
    source.documentType === "storno" || source.documentType === "modify"
      ? "invoice"
      : source.documentType;
  return {
    ...source,
    id: createId(),
    invoiceNumber: "",
    documentType: docType,
    status: "draft",
    originalInvoiceId: undefined,
    modifiesInvoiceId: undefined,
    modificationIndex: undefined,
    paymentMethod: undefined,
    paidAt: undefined,
    paidAmount: undefined,
    lineItems: source.lineItems.map((item) => ({
      ...item,
      id: createId(),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

/** Negated line items for a storno document (pure — used by createStornoInvoice). */
export function buildStornoLineItems(source: Invoice): InvoiceLineItem[] {
  return source.lineItems.map((item) => ({
    ...item,
    id: createId(),
    quantity: -Math.abs(item.quantity),
  }));
}

/**
 * Creates the storno document (its own number, via the shared invoice
 * sequence) and flips the original invoice to status "cancelled". Both
 * directions of the link are then queryable: storno.originalInvoiceId, and
 * `listInvoices({ ... })`/getInvoiceById callers can look up storno docs by
 * originalInvoiceId == original.id for the reverse link in the detail UI.
 */
export async function createStornoInvoice(
  userId: string,
  source: Invoice
): Promise<Invoice> {
  const now = new Date().toISOString();
  const storno: Invoice = {
    ...source,
    id: createId(),
    invoiceNumber: "",
    documentType: "storno",
    status: "sent",
    lineItems: buildStornoLineItems(source),
    notes: `Sztornó – eredeti bizonylat: ${source.invoiceNumber || source.id}`,
    originalInvoiceId: source.id,
    modifiesInvoiceId: undefined,
    modificationIndex: undefined,
    paymentMethod: undefined,
    paidAt: undefined,
    paidAmount: undefined,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await upsertInvoice(userId, storno);
  await db
    .update(invoice)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(invoice.id, source.id), eq(invoice.userId, userId)));

  return saved;
}

/** Invoices whose modifiesInvoiceId points at sourceId (storno docs are excluded by caller). */
export async function findInvoicesReferencing(
  userId: string,
  field: "originalInvoiceId" | "modifiesInvoiceId" | "convertedFromInvoiceId",
  sourceId: string
): Promise<Invoice[]> {
  const column =
    field === "originalInvoiceId"
      ? invoice.originalInvoiceId
      : field === "modifiesInvoiceId"
        ? invoice.modifiesInvoiceId
        : invoice.convertedFromInvoiceId;
  const rows = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.userId, userId), eq(column, sourceId)));
  const itemsByInvoice = await loadLineItemsForInvoices(rows.map((row) => row.id));
  return rows.map((row) => mapInvoiceFromDb(row, itemsByInvoice.get(row.id) ?? []));
}

/**
 * Starts a helyesbítő (correction) document as a minimal draft prefilled
 * with the original's lines. modificationIndex counts prior corrections
 * against the same original so NAV XML can report which correction this is.
 */
export async function createModificationDraft(
  userId: string,
  source: Invoice
): Promise<Invoice> {
  const now = new Date().toISOString();
  const priorModifications = await findInvoicesReferencing(
    userId,
    "modifiesInvoiceId",
    source.id
  );
  const draft: Invoice = {
    ...source,
    id: createId(),
    invoiceNumber: "",
    documentType: "modify",
    status: "draft",
    lineItems: source.lineItems.map((item) => ({ ...item, id: createId() })),
    notes: `Helyesbítő – eredeti bizonylat: ${source.invoiceNumber || source.id}`,
    originalInvoiceId: undefined,
    modifiesInvoiceId: source.id,
    modificationIndex: priorModifications.length + 1,
    paymentMethod: undefined,
    paidAt: undefined,
    paidAmount: undefined,
    createdAt: now,
    updatedAt: now,
  };
  return upsertInvoice(userId, draft);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Számla készítése ebből" — turns a paid díjbekérő into a draft invoice
 * (see lib/invoices/convert-proforma.ts for the pure build). Persisted as a
 * draft, so upsertInvoice never allocates a document_sequence number here —
 * numbering only happens once the user finalizes the draft in the composer.
 */
export async function convertProformaToInvoice(
  userId: string,
  proforma: Invoice
): Promise<Invoice> {
  const draft = buildInvoiceFromProforma(proforma, todayIsoDate());
  return upsertInvoice(userId, draft);
}

/**
 * The non-cancelled invoice already converted from this díjbekérő, if any
 * (used to refuse converting the same proforma twice). A cancelled
 * conversion does not block a retry.
 */
export async function findExistingConversion(
  userId: string,
  proformaId: string
): Promise<Invoice | null> {
  const candidates = await findInvoicesReferencing(userId, "convertedFromInvoiceId", proformaId);
  return candidates.find((inv) => inv.status !== "cancelled") ?? null;
}

export type MarkInvoicePaidInput = {
  paymentMethod?: PaymentMethod;
  /** ISO date/time; defaults to now. */
  paidAt?: string;
  /**
   * The amount of *this* payment (not the invoice's running total-paid) —
   * defaults to the full outstanding balance (total minus amount already
   * paid). Accumulated onto invoice.paidAmount, never overwrites it, so
   * recording a second partial payment adds to the first instead of
   * clobbering it.
   */
  paidAmount?: number;
};

/** "Fizetettnek jelölés" — records payment and derives paid/partially_paid/unpaid/overdue. */
export async function markInvoicePaid(
  userId: string,
  id: string,
  input: MarkInvoicePaidInput = {}
): Promise<Invoice | null> {
  const existing = await getInvoiceById(userId, id);
  if (!existing) return null;

  const totals = calculateInvoiceTotals(existing.lineItems);
  const paidAt = input.paidAt ?? new Date().toISOString();
  const alreadyPaid = existing.paidAmount ?? 0;
  const outstanding = Math.max(0, totals.totalAmount - alreadyPaid);
  const paidAmount = alreadyPaid + (input.paidAmount ?? outstanding);
  const status = deriveInvoiceStatusFromPayment(
    totals.totalAmount,
    paidAmount,
    existing.dueDate,
    new Date(paidAt)
  );

  const updated: Invoice = {
    ...existing,
    paymentMethod: input.paymentMethod ?? existing.paymentMethod,
    paidAt,
    paidAmount,
    status,
    updatedAt: new Date().toISOString(),
  };
  return upsertInvoice(userId, updated);
}
