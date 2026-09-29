// lib/nav/list-submissions.ts
// Shared query for an invoice's NAV submissions, most recent first — used
// by both the internal GET /api/nav/status route and the external v1
// GET /api/v1/invoices/:id/nav route.
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { navSubmission } from "@/db/schema";

export async function listNavSubmissionsForInvoice(invoiceId: string) {
  return db
    .select()
    .from(navSubmission)
    .where(eq(navSubmission.invoiceId, invoiceId))
    .orderBy(desc(navSubmission.createdAt));
}
