// lib/receipts/service.ts
import { and, between, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { receipt, receiptLineItem } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import {
  calculateLineItemTotals,
  type ReceiptLineItemCalcInput,
  type VatBreakdownEntry,
} from "@/lib/receipts/calculations";
import { generateReceiptNumber } from "@/lib/receipts/numbers";
import { buildReceiptQrUrl } from "@/lib/receipts/qr-payload";
import type { PublicReceiptView, ReceiptCurrency } from "@/lib/receipts/types";

export type { VatBreakdownEntry } from "@/lib/receipts/calculations";
export { calculateLineItemTotals } from "@/lib/receipts/calculations";

export type ReceiptLineItemInput = ReceiptLineItemCalcInput;

export type ReceiptInput = {
  receiptNumber?: string;
  clientName?: string;
  totalAmount?: number;
  currency?: ReceiptCurrency;
  paymentMethod?: string;
  lineItems?: ReceiptLineItemInput[];
};

export type ReceiptLineItemRecord = {
  id: string;
  receiptId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  unit: string;
  sortOrder: number;
};

export type ReceiptRecord = {
  id: string;
  userId: string;
  receiptNumber: string;
  clientName?: string;
  totalAmount: number;
  currency: ReceiptCurrency;
  paymentMethod: string;
  qrToken: string;
  qrUrl: string;
  navSubmitted: boolean;
  lineItems: ReceiptLineItemRecord[];
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(
  row: typeof receipt.$inferSelect,
  items: (typeof receiptLineItem.$inferSelect)[] = []
): ReceiptRecord {
  return {
    id: row.id,
    userId: row.userId,
    receiptNumber: row.receiptNumber,
    clientName: row.clientName ?? undefined,
    totalAmount: Number(row.totalAmount),
    currency: row.currency as ReceiptCurrency,
    paymentMethod: row.paymentMethod ?? "cash",
    qrToken: row.qrToken,
    qrUrl: buildReceiptQrUrl(row.qrToken),
    navSubmitted: row.navSubmitted,
    lineItems: items.map((li) => ({
      id: li.id,
      receiptId: li.receiptId,
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      vatRate: li.vatRate,
      unit: li.unit ?? "db",
      sortOrder: li.sortOrder,
    })),
    issuedAt: row.issuedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function validateReceiptInput(input: Partial<ReceiptInput>): string | null {
  const hasLineItems = input.lineItems && input.lineItems.length > 0;

  if (!hasLineItems && (input.totalAmount === undefined || input.totalAmount === null)) {
    return "totalAmount or lineItems required.";
  }
  if (input.totalAmount !== undefined) {
    if (typeof input.totalAmount !== "number" || Number.isNaN(input.totalAmount)) {
      return "totalAmount must be a number.";
    }
    if (input.totalAmount <= 0 && !hasLineItems) {
      return "totalAmount must be greater than zero.";
    }
  }
  if (input.currency && input.currency !== "EUR" && input.currency !== "HUF") {
    return "currency must be EUR or HUF.";
  }
  if (input.receiptNumber !== undefined && !input.receiptNumber.trim()) {
    return "receiptNumber cannot be empty.";
  }
  if (hasLineItems) {
    for (const item of input.lineItems!) {
      if (!item.description?.trim()) return "Line item description is required.";
      if (item.quantity <= 0) return "Line item quantity must be positive.";
      if (item.unitPrice < 0) return "Line item unit price cannot be negative.";
    }
  }
  return null;
}

export async function listReceipts(userId: string): Promise<ReceiptRecord[]> {
  const rows = await db
    .select()
    .from(receipt)
    .where(eq(receipt.userId, userId))
    .orderBy(desc(receipt.issuedAt));

  const receiptIds = rows.map((r) => r.id);
  const allItems =
    receiptIds.length > 0
      ? await db
          .select()
          .from(receiptLineItem)
          .where(
            receiptIds.length === 1
              ? eq(receiptLineItem.receiptId, receiptIds[0])
              : eq(receiptLineItem.receiptId, receiptIds[0])
          )
      : [];

  const itemsByReceipt = new Map<string, (typeof receiptLineItem.$inferSelect)[]>();
  for (const item of allItems) {
    const list = itemsByReceipt.get(item.receiptId) ?? [];
    list.push(item);
    itemsByReceipt.set(item.receiptId, list);
  }

  return rows.map((r) => mapRow(r, itemsByReceipt.get(r.id) ?? []));
}

async function receiptNumberInUse(
  userId: string,
  num: string,
  excludeId?: string
): Promise<boolean> {
  const rows = await db
    .select({ id: receipt.id })
    .from(receipt)
    .where(and(eq(receipt.userId, userId), eq(receipt.receiptNumber, num)));
  if (excludeId) {
    return rows.some((row) => row.id !== excludeId);
  }
  return rows.length > 0;
}

export async function createReceipt(
  userId: string,
  input: ReceiptInput
): Promise<ReceiptRecord> {
  const validationError = validateReceiptInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const existing = await listReceipts(userId);
  const receiptNum =
    input.receiptNumber?.trim() || generateReceiptNumber(existing);

  if (await receiptNumberInUse(userId, receiptNum)) {
    throw new Error("Receipt number already exists for this account.");
  }

  const hasLineItems = input.lineItems && input.lineItems.length > 0;
  let totalAmount: number;
  if (hasLineItems) {
    const totals = calculateLineItemTotals(input.lineItems!);
    totalAmount = totals.grossTotal;
  } else {
    totalAmount = input.totalAmount!;
  }

  const now = new Date();
  const id = createId();
  const qrToken = createId();

  const [row] = await db
    .insert(receipt)
    .values({
      id,
      userId,
      receiptNumber: receiptNum,
      clientName: input.clientName?.trim() || null,
      totalAmount: String(totalAmount),
      currency: input.currency ?? "HUF",
      paymentMethod: input.paymentMethod ?? "cash",
      qrToken,
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  let items: (typeof receiptLineItem.$inferSelect)[] = [];
  if (hasLineItems) {
    items = await db
      .insert(receiptLineItem)
      .values(
        input.lineItems!.map((li, idx) => ({
          id: createId(),
          receiptId: id,
          description: li.description.trim(),
          quantity: String(li.quantity),
          unitPrice: String(li.unitPrice),
          vatRate: li.vatRate,
          unit: li.unit ?? "db",
          sortOrder: idx,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .returning();
  }

  return mapRow(row, items);
}

export async function getReceiptById(
  userId: string,
  receiptId: string
): Promise<ReceiptRecord | null> {
  const [row] = await db
    .select()
    .from(receipt)
    .where(and(eq(receipt.id, receiptId), eq(receipt.userId, userId)));
  if (!row) return null;

  const items = await db
    .select()
    .from(receiptLineItem)
    .where(eq(receiptLineItem.receiptId, receiptId));

  return mapRow(row, items);
}

export async function getPublicReceiptByToken(
  token: string
): Promise<PublicReceiptView | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const [row] = await db.select().from(receipt).where(eq(receipt.qrToken, trimmed));
  if (!row) return null;

  const company = await getCompanyByUserId(row.userId);

  return {
    receiptNumber: row.receiptNumber,
    clientName: row.clientName,
    totalAmount: Number(row.totalAmount),
    currency: row.currency as ReceiptCurrency,
    issuedAt: row.issuedAt.toISOString(),
    issuerName: company?.name ?? "InvoHub merchant",
    verified: true,
  };
}

export async function getReceiptsByDateRange(
  userId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<ReceiptRecord[]> {
  const rows = await db
    .select()
    .from(receipt)
    .where(
      and(
        eq(receipt.userId, userId),
        between(receipt.issuedAt, dateFrom, dateTo)
      )
    )
    .orderBy(receipt.issuedAt);

  const receiptIds = rows.map((r) => r.id);
  if (receiptIds.length === 0) return [];

  const allItems = await db
    .select()
    .from(receiptLineItem)
    .where(eq(receiptLineItem.receiptId, receiptIds[0]));

  for (let i = 1; i < receiptIds.length; i++) {
    const moreItems = await db
      .select()
      .from(receiptLineItem)
      .where(eq(receiptLineItem.receiptId, receiptIds[i]));
    allItems.push(...moreItems);
  }

  const itemsByReceipt = new Map<string, (typeof receiptLineItem.$inferSelect)[]>();
  for (const item of allItems) {
    const list = itemsByReceipt.get(item.receiptId) ?? [];
    list.push(item);
    itemsByReceipt.set(item.receiptId, list);
  }

  return rows.map((r) => mapRow(r, itemsByReceipt.get(r.id) ?? []));
}

export async function getDailyVatAggregation(
  userId: string,
  date: Date
): Promise<{
  reportDate: string;
  receiptCount: number;
  startReceiptNumber: string | null;
  endReceiptNumber: string | null;
  vatBreakdown: VatBreakdownEntry[];
}> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const receipts = await getReceiptsByDateRange(userId, dayStart, dayEnd);

  const allLineItems = receipts.flatMap((r) => r.lineItems);
  const totals = calculateLineItemTotals(
    allLineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      vatRate: li.vatRate,
    }))
  );

  const sorted = receipts.sort((a, b) => a.receiptNumber.localeCompare(b.receiptNumber));

  return {
    reportDate: dayStart.toISOString().slice(0, 10),
    receiptCount: receipts.length,
    startReceiptNumber: sorted[0]?.receiptNumber ?? null,
    endReceiptNumber: sorted[sorted.length - 1]?.receiptNumber ?? null,
    vatBreakdown: totals.vatBreakdown,
  };
}
