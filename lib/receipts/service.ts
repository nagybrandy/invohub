// lib/receipts/service.ts
// Receipt CRUD with QR token generation and public verification lookup.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { receipt } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import { generateReceiptNumber } from "@/lib/receipts/numbers";
import { buildReceiptQrUrl } from "@/lib/receipts/qr-payload";
import type { PublicReceiptView, ReceiptCurrency } from "@/lib/receipts/types";

export type ReceiptInput = {
  receiptNumber?: string;
  clientName?: string;
  totalAmount: number;
  currency?: ReceiptCurrency;
};

export type ReceiptRecord = {
  id: string;
  userId: string;
  receiptNumber: string;
  clientName?: string;
  totalAmount: number;
  currency: ReceiptCurrency;
  qrToken: string;
  qrUrl: string;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof receipt.$inferSelect): ReceiptRecord {
  return {
    id: row.id,
    userId: row.userId,
    receiptNumber: row.receiptNumber,
    clientName: row.clientName ?? undefined,
    totalAmount: Number(row.totalAmount),
    currency: row.currency as ReceiptCurrency,
    qrToken: row.qrToken,
    qrUrl: buildReceiptQrUrl(row.qrToken),
    issuedAt: row.issuedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function validateReceiptInput(input: Partial<ReceiptInput>): string | null {
  if (input.totalAmount === undefined || input.totalAmount === null) {
    return "totalAmount is required.";
  }
  if (typeof input.totalAmount !== "number" || Number.isNaN(input.totalAmount)) {
    return "totalAmount must be a number.";
  }
  if (input.totalAmount <= 0) {
    return "totalAmount must be greater than zero.";
  }
  if (input.currency && input.currency !== "EUR" && input.currency !== "HUF") {
    return "currency must be EUR or HUF.";
  }
  if (input.receiptNumber !== undefined && !input.receiptNumber.trim()) {
    return "receiptNumber cannot be empty.";
  }
  return null;
}

export async function listReceipts(userId: string): Promise<ReceiptRecord[]> {
  const rows = await db
    .select()
    .from(receipt)
    .where(eq(receipt.userId, userId))
    .orderBy(desc(receipt.issuedAt));
  return rows.map(mapRow);
}

async function receiptNumberInUse(
  userId: string,
  receiptNumber: string,
  excludeId?: string
): Promise<boolean> {
  const rows = await db
    .select({ id: receipt.id })
    .from(receipt)
    .where(and(eq(receipt.userId, userId), eq(receipt.receiptNumber, receiptNumber)));
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
  const receiptNumber =
    input.receiptNumber?.trim() || generateReceiptNumber(existing);

  if (await receiptNumberInUse(userId, receiptNumber)) {
    throw new Error("Receipt number already exists for this account.");
  }

  const now = new Date();
  const id = createId();
  const qrToken = createId();

  const [row] = await db
    .insert(receipt)
    .values({
      id,
      userId,
      receiptNumber,
      clientName: input.clientName?.trim() || null,
      totalAmount: String(input.totalAmount),
      currency: input.currency ?? "HUF",
      qrToken,
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function getReceiptById(
  userId: string,
  id: string
): Promise<ReceiptRecord | null> {
  const [row] = await db
    .select()
    .from(receipt)
    .where(and(eq(receipt.id, id), eq(receipt.userId, userId)));
  return row ? mapRow(row) : null;
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
