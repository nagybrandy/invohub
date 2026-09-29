// lib/nav/latest-submission-store.ts
// The two thin loaders behind latestStatusByInvoice — kept apart from the
// pure reduction so that module can be tested without a database.
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { invoice, navSubmission } from "@/db/schema";
import { latestStatusByInvoice } from "@/lib/nav/latest-submission";

/** Latest status for each of a page's invoices — one query, page-sized. */
export async function loadLatestNavStatusByInvoice(invoiceIds: string[]): Promise<Map<string, string>> {
  if (invoiceIds.length === 0) return new Map();
  const rows = await db
    .select({ invoiceId: navSubmission.invoiceId, status: navSubmission.status, createdAt: navSubmission.createdAt })
    .from(navSubmission)
    .where(inArray(navSubmission.invoiceId, invoiceIds));
  return latestStatusByInvoice(rows);
}

/** Latest status for every invoice of a user — for the dashboard's failure count. */
export async function loadLatestNavStatusForUser(userId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ invoiceId: navSubmission.invoiceId, status: navSubmission.status, createdAt: navSubmission.createdAt })
    .from(navSubmission)
    .leftJoin(invoice, eq(invoice.id, navSubmission.invoiceId))
    .where(eq(invoice.userId, userId));
  return latestStatusByInvoice(rows);
}
