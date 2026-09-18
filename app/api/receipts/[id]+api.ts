// app/api/receipts/[id]+api.ts
// Single receipt GET.
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { navReceiptSubmission } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getCompanyByUserId } from "@/lib/companies/service";
import { parseNavReceiptEnvironment } from "@/lib/nav-receipt/environment";
import { getReceiptById } from "@/lib/receipts/service";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  try {
    const session = await requireSession(request);
    if (!session) return unauthorizedResponse();

    const id = await resolveIdParam(request, params);
    if (!id?.trim()) {
      return jsonResponse({ error: "Receipt id is required." }, 400);
    }

    const receipt = await getReceiptById(session.user.id, id);
    if (!receipt) return jsonResponse({ error: "Not found" }, 404);

    const comp = await getCompanyByUserId(session.user.id);
    const navMode = parseNavReceiptEnvironment(comp?.navEnvironment);

    const reportDate = new Date(receipt.issuedAt).toISOString().slice(0, 10);
    const [lastSubmission] = await db
      .select()
      .from(navReceiptSubmission)
      .where(
        and(
          eq(navReceiptSubmission.userId, session.user.id),
          eq(navReceiptSubmission.reportDate, reportDate)
        )
      )
      .orderBy(desc(navReceiptSubmission.createdAt))
      .limit(1);

    return jsonResponse({
      receipt,
      navMode,
      navReportId: lastSubmission?.status === "submitted" ? lastSubmission.transactionId ?? null : null,
      navError: lastSubmission?.status === "failed" ? lastSubmission.errorMessage ?? null : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load receipt.";
    return jsonResponse({ error: message }, 500);
  }
}
