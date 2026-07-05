// lib/nav/incoming-sync.ts
// Pulls incoming invoices from NAV and upserts into DB.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomingInvoice } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import { buildNavCredentials } from "@/lib/nav/credentials";
import { fetchIncomingInvoices } from "@/lib/nav/client";

export async function syncIncomingInvoices(userId: string) {
  const company = await getCompanyByUserId(userId);
  const credentials = buildNavCredentials(company);

  const navInvoices = await fetchIncomingInvoices(credentials);
  const now = new Date();
  let synced = 0;

  for (const nav of navInvoices) {
    const existing = await db
      .select()
      .from(incomingInvoice)
      .where(eq(incomingInvoice.navInvoiceId, nav.navInvoiceId))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(incomingInvoice).values({
      id: createId(),
      userId,
      navInvoiceId: nav.navInvoiceId,
      supplierName: nav.supplierName,
      supplierTaxNumber: nav.supplierTaxNumber,
      invoiceNumber: nav.invoiceNumber,
      issueDate: nav.issueDate,
      dueDate: nav.dueDate,
      totalAmount: String(nav.totalAmount),
      currency: nav.currency,
      status: "received",
      rawPayload: JSON.stringify(nav),
      createdAt: now,
      updatedAt: now,
    });
    synced += 1;
  }

  const all = await db
    .select()
    .from(incomingInvoice)
    .where(eq(incomingInvoice.userId, userId));

  return { synced, invoices: all };
}
