// lib/nav/submission-store.ts
// nav_submission row writes for the guarded submit flow in
// lib/nav/submit-outgoing.ts. Kept separate so the orchestration can be
// unit-tested against a mock of this module instead of a Drizzle chain.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { navSubmission } from "@/db/schema";
import { createId } from "@/lib/id";
import type { NavEnvironment } from "@/lib/nav/environment";
import { listNavSubmissionsForInvoice } from "@/lib/nav/list-submissions";

export type NavSubmissionRecord = Awaited<ReturnType<typeof listNavSubmissionsForInvoice>>[number];

/**
 * Writes the `pending` claim row BEFORE any NAV call. createdAt is left to
 * the database default (now()) so concurrent claims are ordered by one
 * clock — see pickBlockingSubmission.
 */
export async function claimNavSubmission(invoiceId: string, mode: NavEnvironment): Promise<string> {
  const id = createId();
  await db.insert(navSubmission).values({ id, invoiceId, status: "pending", mode });
  return id;
}

export async function releaseNavSubmissionClaim(id: string): Promise<void> {
  await db.delete(navSubmission).where(eq(navSubmission.id, id));
}

export async function markNavSubmissionSent(id: string, transactionId: string): Promise<void> {
  const now = new Date();
  await db
    .update(navSubmission)
    .set({ status: "sent", transactionId, errorMessage: null, submittedAt: now, updatedAt: now })
    .where(eq(navSubmission.id, id));
}

export async function markNavSubmissionFailed(id: string, errorMessage: string): Promise<void> {
  await db
    .update(navSubmission)
    .set({ status: "error", errorMessage: errorMessage.slice(0, 2000), updatedAt: new Date() })
    .where(eq(navSubmission.id, id));
}

export async function listNavSubmissionRecords(invoiceId: string): Promise<NavSubmissionRecord[]> {
  return listNavSubmissionsForInvoice(invoiceId);
}

export async function getNavSubmissionRecord(invoiceId: string, id: string): Promise<NavSubmissionRecord | null> {
  const rows = await listNavSubmissionsForInvoice(invoiceId);
  return rows.find((row) => row.id === id) ?? null;
}
