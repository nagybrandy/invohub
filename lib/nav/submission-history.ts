// lib/nav/submission-history.ts
// Whether an invoice was ever actually reported to NAV — feeds the
// <invoiceReference><modifyWithoutMaster> flag on MODIFY/STORNO submissions
// (see lib/nav/submit-outgoing.ts, lib/nav/invoice-xml.ts).
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { navSubmission } from "@/db/schema";

/**
 * True if `invoiceId` has at least one NAV submission whose polled status
 * reached "done" (app/api/nav/status+api.ts lowercases the NAV
 * queryTransactionStatus result — "DONE" -> "done" — onto this column).
 * A submission still pending/processing, or one that was aborted, does NOT
 * count: per the XSD's own wording, `modifyWithoutMaster` means the
 * original "is not and will not be exchanged" with NAV, so only a
 * confirmed exchange should flip it to false.
 */
export async function hasSuccessfulNavSubmission(invoiceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: navSubmission.id })
    .from(navSubmission)
    .where(and(eq(navSubmission.invoiceId, invoiceId), eq(navSubmission.status, "done")))
    .limit(1);
  return rows.length > 0;
}
