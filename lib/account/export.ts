// lib/account/export.ts
// Retained-records export for one user (typically a closed account), so the
// owner/admin can hand the retained invoices to the taxpayer or the tax
// authority on request during the 8-year retention window.
// Never includes NAV credentials, sessions, API keys or password hashes.
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  company,
  navReceiptSubmission,
  navSubmission,
  receipt,
  receiptLineItem,
  user,
} from "@/db/schema";
import { listInvoicesInDateRange } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

export type RetainedRecordsExport = {
  exportedAt: string;
  user: {
    id: string;
    closedAt: string | null;
    retentionUntil: string | null;
  };
  companies: Array<Record<string, unknown>>;
  invoices: Invoice[];
  navSubmissions: Array<typeof navSubmission.$inferSelect>;
  receipts: Array<typeof receipt.$inferSelect & { lineItems: Array<typeof receiptLineItem.$inferSelect> }>;
  navReceiptSubmissions: Array<typeof navReceiptSubmission.$inferSelect>;
};

/** Seller data only — NAV technical-user secrets are never exported. */
const companyExportColumns = {
  id: company.id,
  name: company.name,
  taxNumber: company.taxNumber,
  euVatNumber: company.euVatNumber,
  address: company.address,
  city: company.city,
  zipCode: company.zipCode,
  country: company.country,
  bankAccount: company.bankAccount,
  vatExempt: company.vatExempt,
  logoUrl: company.logoUrl,
};

export async function exportRetainedRecords(
  userId: string,
  now: Date = new Date()
): Promise<RetainedRecordsExport | null> {
  const [owner] = await db
    .select({ id: user.id, closedAt: user.closedAt, retentionUntil: user.retentionUntil })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!owner) return null;

  const [companies, allInvoices, receipts, navReceiptSubmissions] = await Promise.all([
    db.select(companyExportColumns).from(company).where(eq(company.userId, userId)),
    listInvoicesInDateRange(userId, "0000-01-01", "9999-12-31"),
    db.select().from(receipt).where(eq(receipt.userId, userId)),
    db.select().from(navReceiptSubmission).where(eq(navReceiptSubmission.userId, userId)),
  ]);

  // Drafts are not issued documents and carry no retention duty.
  const invoices = allInvoices.filter((inv) => inv.status !== "draft");
  const invoiceIds = invoices.map((inv) => inv.id);
  const receiptIds = receipts.map((r) => r.id);

  const [navSubmissions, receiptItems] = await Promise.all([
    invoiceIds.length > 0
      ? db.select().from(navSubmission).where(inArray(navSubmission.invoiceId, invoiceIds))
      : Promise.resolve([]),
    receiptIds.length > 0
      ? db.select().from(receiptLineItem).where(inArray(receiptLineItem.receiptId, receiptIds))
      : Promise.resolve([]),
  ]);

  const itemsByReceipt = new Map<string, Array<typeof receiptLineItem.$inferSelect>>();
  for (const item of receiptItems) {
    const list = itemsByReceipt.get(item.receiptId) ?? [];
    list.push(item);
    itemsByReceipt.set(item.receiptId, list);
  }

  return {
    exportedAt: now.toISOString(),
    user: {
      id: owner.id,
      closedAt: owner.closedAt ? owner.closedAt.toISOString() : null,
      retentionUntil: owner.retentionUntil ? owner.retentionUntil.toISOString() : null,
    },
    companies,
    invoices,
    navSubmissions,
    receipts: receipts.map((r) => ({ ...r, lineItems: itemsByReceipt.get(r.id) ?? [] })),
    navReceiptSubmissions,
  };
}
