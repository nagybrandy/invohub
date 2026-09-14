// lib/nav/incoming-sync.ts
// Pulls incoming invoices from NAV and upserts into DB.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomingInvoice } from "@/db/schema";
import type { Company } from "@/lib/companies/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import { fetchIncomingInvoices, type NavCredentials } from "@/lib/nav/client";

// This demo-shaped stub predates (and is out of scope for) the OSA 3.0
// manageInvoice/queryTaxpayer work in lib/nav/{real-client,simulator}.ts —
// see the note on fetchIncomingInvoices in lib/nav/client.ts.
function buildLegacyNavCredentials(company: Company | null): NavCredentials {
  return {
    technicalUser: company?.navTechnicalUser ?? "sandbox",
    xmlSignKey: company?.navXmlSignKey ?? "sandbox",
    taxNumber: company?.taxNumber ?? "00000000-0-00",
    environment: company?.navEnvironment === "production" ? "production" : "test",
  };
}

export async function syncIncomingInvoices(userId: string) {
  const company = await getCompanyByUserId(userId);
  const credentials = buildLegacyNavCredentials(company);

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
