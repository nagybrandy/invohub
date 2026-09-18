// app/api/receipts/[id]+api.ts
// Single receipt GET.
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { navReceiptSubmission } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getCompanyByUserId } from "@/lib/companies/service";
import { parseNavReceiptEnvironment } from "@/lib/nav-receipt/environment";
import { BLOCKED_EXCHANGE_RATE_MESSAGE_HU } from "@/lib/receipts/daily-report";
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

    // navReceiptSubmission has no currency column (deferred — see
    // docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md §6/§9), and one
    // submission run inserts one row per currency group for the same
    // (userId, reportDate), all with the same createdAt (submit-nav+api.ts,
    // cron/nav-receipt-report+api.ts both use a single `now`). So a plain
    // "most recent row for this date" lookup can hand a HUF receipt's detail
    // screen a different currency group's blocked/failed row (or vice
    // versa). buildDailyReceiptReports only ever reports HUF groups and
    // blocks every non-HUF group with the exact BLOCKED_EXCHANGE_RATE_MESSAGE_HU
    // text (lib/receipts/daily-report.ts), so that message is a reliable
    // discriminator between the two kinds of row for the same reportDate.
    const reportDate = new Date(receipt.issuedAt).toISOString().slice(0, 10);
    const isHufReceipt = receipt.currency === "HUF";
    const submissionsForDate = await db
      .select()
      .from(navReceiptSubmission)
      .where(
        and(
          eq(navReceiptSubmission.userId, session.user.id),
          eq(navReceiptSubmission.reportDate, reportDate)
        )
      )
      .orderBy(desc(navReceiptSubmission.createdAt));
    const lastSubmission = submissionsForDate.find((row) =>
      isHufReceipt
        ? row.errorMessage !== BLOCKED_EXCHANGE_RATE_MESSAGE_HU
        : row.errorMessage === BLOCKED_EXCHANGE_RATE_MESSAGE_HU
    );

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
