// app/api/receipts/[id]/submit-nav+api.ts
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { navReceiptSubmission, receipt } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import { submitDailyReceiptReport } from "@/lib/nav-receipt/report";
import type { NavReceiptCredentials, NavReceiptEnvironment } from "@/lib/nav-receipt/types";
import type { NavReceiptSubmissionResult } from "@/lib/nav-receipt/types";
import { getDailyVatAggregation, getReceiptById } from "@/lib/receipts/service";

type Params = { id: string };

export async function POST(
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

    const receiptRecord = await getReceiptById(session.user.id, id);
    if (!receiptRecord) return jsonResponse({ error: "Not found" }, 404);

    if (receiptRecord.navSubmitted) {
      return jsonResponse({ error: "Already submitted to NAV." }, 400);
    }

    const comp = await getCompanyByUserId(session.user.id);
    if (!comp) {
      return jsonResponse({ error: "Company profile required. Update company settings." }, 400);
    }
    const navMode = comp.navEnvironment ?? "demo";

    // Demo mode (the default) never calls the real receipt-if/v1 endpoint —
    // its request/response shape is not verified against an official NAV
    // schema/sample (unlike lib/nav/, this predates that verification pass).
    // See docs/nav-test-setup.md openIssues. Test/production mode keeps the
    // existing (unverified) real call for owners who explicitly opt in.
    if (navMode !== "demo" && (!comp.navTechnicalUser || !comp.navTechnicalPassword || !comp.navXmlSignKey || !comp.taxNumber)) {
      return jsonResponse(
        { error: "NAV credentials not configured. Update company settings." },
        400
      );
    }

    const issuedDate = new Date(receiptRecord.issuedAt);
    const reportDate = issuedDate.toISOString().slice(0, 10);

    const aggregation = await getDailyVatAggregation(session.user.id, issuedDate);

    const submissionId = createId();
    const now = new Date();

    await db.insert(navReceiptSubmission).values({
      id: submissionId,
      userId: session.user.id,
      companyId: comp.id,
      reportDate,
      status: "pending",
      receiptCount: aggregation.receiptCount,
      cancelledCount: 0,
        startReceiptNumber: aggregation.startReceiptNumber ?? "",
        endReceiptNumber: aggregation.endReceiptNumber ?? "",
        vatBreakdown: JSON.stringify(aggregation.vatBreakdown),
        createdAt: now,
        updatedAt: now,
      });

    let navResult: NavReceiptSubmissionResult;
    if (navMode === "demo") {
      // Demo mode: simulate acceptance, no network call to the unverified endpoint.
      navResult = { ok: true, transactionId: `RECEIPT-DEMO-${Date.now()}` };
    } else {
      const credentials: NavReceiptCredentials = {
        technicalUser: comp!.navTechnicalUser!,
        technicalPassword: comp!.navTechnicalPassword!,
        signingKey: comp!.navXmlSignKey!,
        taxNumber: comp!.taxNumber!,
      };
      const env: NavReceiptEnvironment = navMode === "production" ? "production" : "test";

      navResult = await submitDailyReceiptReport(
        {
          taxNumber: comp!.taxNumber!,
          softwareId: (comp as any).navReceiptSoftwareId ?? "INVOHUB-DEFAULT",
          reportDate,
          startReceiptNumber: aggregation.startReceiptNumber ?? "",
          endReceiptNumber: aggregation.endReceiptNumber ?? "",
          receiptCount: aggregation.receiptCount,
          cancelledCount: 0,
          vatAggregations: aggregation.vatBreakdown.map((v) => ({
            vatRateCode: `${v.vatRate}%`,
            vatRate: v.vatRate,
            netAmount: v.netAmount,
            vatAmount: v.vatAmount,
            grossAmount: v.grossAmount,
            receiptCount: v.itemCount,
          })),
        },
        credentials,
        env
      );
    }

    const finalStatus = navResult.ok ? "submitted" : "failed";

    await db
      .update(navReceiptSubmission)
      .set({
        status: finalStatus,
        transactionId: navResult.transactionId ?? null,
        errorMessage: navResult.error ?? null,
        submittedAt: navResult.ok ? now : null,
        updatedAt: now,
      })
      .where(eq(navReceiptSubmission.id, submissionId));

    if (navResult.ok) {
      await db
        .update(receipt)
        .set({ navSubmitted: true, updatedAt: now })
        .where(eq(receipt.id, id));
    }

    return jsonResponse({
      ok: navResult.ok,
      submissionId,
      reportDate,
      receiptCount: aggregation.receiptCount,
      transactionId: navResult.transactionId,
      error: navResult.error,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NAV submission failed.";
    return jsonResponse({ error: message }, 500);
  }
}
