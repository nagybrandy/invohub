// app/api/receipts/[id]/submit-nav+api.ts
// Manual "report this receipt's day to NAV" — the on-demand twin of the
// nightly cron (lib/nav-receipt/daily-report-run.ts), on the rebuilt
// eRECEIPT client. A NAV receipt report covers a whole day per currency, so
// this submits the HUF report of the receipt's Budapest calendar day; non-HUF
// groups are refused (no stored exchange rate) and recorded as blocked.
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { navReceiptSubmission, receipt } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getCompanyByUserId } from "@/lib/companies/service";
import { budapestDayRange } from "@/lib/dates/budapest";
import { createId } from "@/lib/id";
import { NavCredentialsMissingError, openCompanyNavSecrets } from "@/lib/nav/resolve-credentials";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import type { NavReceiptCredentials, NavReceiptSubmissionResult } from "@/lib/nav-receipt/types";
import { BLOCKED_EXCHANGE_RATE_MESSAGE_HU, buildDailyReceiptReports } from "@/lib/receipts/daily-report";
import { receiptReportDate } from "@/lib/receipts/report-date";
import {
  getReceiptById,
  getReceiptsByDateRange,
  markReceiptsSubmittedForRange,
} from "@/lib/receipts/service";

type Params = { id: string };

/** The only currency InvoHub can report: a receipt stores no exchange rate. */
const REPORTABLE_CURRENCY = "HUF";

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
      return jsonResponse({ error: "Already submitted to NAV.", code: "receiptAlreadySubmitted" }, 400);
    }

    const comp = await getCompanyByUserId(session.user.id);
    if (!comp) {
      return jsonResponse({ error: "Company profile required. Update company settings." }, 400);
    }
    const navMode = comp.navEnvironment ?? "demo";

    const reportDate = receiptReportDate(receiptRecord.issuedAt);
    const now = new Date();

    if (navMode === "demo") {
      // Demo mode never calls NAV — simulate acceptance for the submitted
      // receipt without aggregating the whole day.
      const submissionId = createId();
      const transactionId = `RECEIPT-DEMO-${Date.now()}`;
      await db.insert(navReceiptSubmission).values({
        id: submissionId,
        userId: session.user.id,
        companyId: comp.id,
        reportDate,
        status: "submitted",
        receiptCount: 1,
        transactionId,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.update(receipt).set({ navSubmitted: true, updatedAt: now }).where(eq(receipt.id, id));
      return jsonResponse({ ok: true, mode: "demo", submissionId, reportDate, receiptCount: 1, transactionId });
    }

    if (navMode === "production") {
      // There is no verified production eRECEIPT host, and this repo must
      // never call a NAV production endpoint (CLAUDE.md "NAV modes") —
      // refused outright, whatever NAV_PRODUCTION_ENABLED says.
      return jsonResponse(
        {
          error: "NAV eNyugta production reporting is not available on this server.",
          code: "navReceiptProductionUnsupported",
        },
        400
      );
    }

    if (!comp.navTechnicalUser || !comp.navTechnicalPassword || !comp.navXmlSignKey || !comp.taxNumber) {
      return jsonResponse(
        { error: "NAV credentials not configured. Update company settings." },
        400
      );
    }

    // Stored secrets are sealed (lib/nav/credentials.ts); open them only now,
    // right before the NAV call, and before any row is written.
    let secrets: ReturnType<typeof openCompanyNavSecrets>;
    try {
      secrets = openCompanyNavSecrets(comp);
    } catch (e) {
      if (e instanceof NavCredentialsMissingError) return jsonResponse({ error: e.message }, 400);
      throw e;
    }
    const credentials: NavReceiptCredentials = {
      technicalUser: comp.navTechnicalUser,
      technicalPassword: secrets.password!,
      signingKey: secrets.signKey!,
      taxNumber: comp.taxNumber,
    };

    const { start, end } = budapestDayRange(reportDate);

    // A day is reported once. If its report already went through (the
    // nightly cron, or this route from another receipt of the same day),
    // flag what it covered instead of sending the day to NAV a second time.
    const dayRows = await db
      .select()
      .from(navReceiptSubmission)
      .where(and(eq(navReceiptSubmission.companyId, comp.id), eq(navReceiptSubmission.reportDate, reportDate)));
    const alreadyReported = dayRows.find((row) => row.status === "submitted");
    if (alreadyReported) {
      if (receiptRecord.currency !== REPORTABLE_CURRENCY) {
        return jsonResponse({
          ok: false,
          mode: navMode,
          reportDate,
          error: BLOCKED_EXCHANGE_RATE_MESSAGE_HU,
          code: "missing_exchange_rate",
        });
      }
      await markReceiptsSubmittedForRange(session.user.id, start, end, REPORTABLE_CURRENCY);
      return jsonResponse({
        ok: true,
        mode: navMode,
        reportDate,
        alreadyReported: true,
        submissionId: alreadyReported.id,
        transactionId: alreadyReported.transactionId ?? undefined,
      });
    }

    const dayReceipts = await getReceiptsByDateRange(session.user.id, start, end);
    const { reports, blocked } = buildDailyReceiptReports(dayReceipts, {
      taxPayerId: comp.taxNumber,
      issuingSoftwareName: comp.navReceiptSoftwareId ?? "InvoHub",
      applicableDate: reportDate,
      vatExempt: comp.vatExempt,
    });

    const submissions: { ok: boolean; reportId?: string; error?: string }[] = [];

    if (blocked.length > 0) {
      // One blocked row per (company, date), refreshed in place.
      const blockedReceipts = blocked.reduce((sum, group) => sum + group.receiptCount, 0);
      const existingBlocked = dayRows.find((row) => row.errorMessage === BLOCKED_EXCHANGE_RATE_MESSAGE_HU);
      if (existingBlocked) {
        await db
          .update(navReceiptSubmission)
          .set({ receiptCount: blockedReceipts, updatedAt: now })
          .where(eq(navReceiptSubmission.id, existingBlocked.id));
      } else {
        await db.insert(navReceiptSubmission).values({
          id: createId(),
          userId: session.user.id,
          companyId: comp.id,
          reportDate,
          status: "failed",
          receiptCount: blockedReceipts,
          cancelledCount: 0,
          errorMessage: BLOCKED_EXCHANGE_RATE_MESSAGE_HU,
          createdAt: now,
          updatedAt: now,
        });
      }
      submissions.push({ ok: false, error: BLOCKED_EXCHANGE_RATE_MESSAGE_HU });
    }

    const report = reports.find((r) => r.currency === REPORTABLE_CURRENCY);
    let submissionId: string | undefined;
    let navResult: NavReceiptSubmissionResult | undefined;

    if (report) {
      const reportedNumbers = dayReceipts
        .filter((r) => r.currency === REPORTABLE_CURRENCY)
        .map((r) => r.receiptNumber)
        .sort((a, b) => a.localeCompare(b));

      submissionId = createId();
      await db.insert(navReceiptSubmission).values({
        id: submissionId,
        userId: session.user.id,
        companyId: comp.id,
        reportDate,
        status: "pending",
        attemptCount: 1,
        receiptCount: report.numberOfSaleDocument,
        cancelledCount: 0,
        startReceiptNumber: reportedNumbers[0] ?? "",
        endReceiptNumber: reportedNumbers[reportedNumbers.length - 1] ?? "",
        vatBreakdown: JSON.stringify(report.vatCategoryItems),
        createdAt: now,
        updatedAt: now,
      });

      try {
        navResult = await submitReceiptDataReport(report, credentials, "test");
      } catch (e) {
        // Never leave the row "pending": the cron's retry-in-place reads it.
        navResult = { ok: false, error: safeErrorMessage(e, "NAV submission failed.") };
      }

      const finishedAt = new Date();
      await db
        .update(navReceiptSubmission)
        .set({
          status: navResult.ok ? "submitted" : "failed",
          transactionId: navResult.reportId ?? null,
          errorMessage: navResult.error ?? null,
          submittedAt: navResult.ok ? finishedAt : null,
          updatedAt: finishedAt,
        })
        .where(eq(navReceiptSubmission.id, submissionId));

      submissions.push({ ok: navResult.ok, reportId: navResult.reportId, error: navResult.error });

      if (navResult.ok) {
        // The report covered every HUF receipt of the day — flag them all, so
        // none of them can trigger the same day's report again.
        await markReceiptsSubmittedForRange(session.user.id, start, end, REPORTABLE_CURRENCY);
      }
    }

    // "ok" is about the receipt that was asked for: reported only if its own
    // currency group went through.
    const ok = receiptRecord.currency === REPORTABLE_CURRENCY && navResult?.ok === true;

    return jsonResponse({
      ok,
      mode: navMode,
      submissionId,
      reportDate,
      receiptCount: report?.numberOfSaleDocument ?? 0,
      transactionId: navResult?.reportId,
      error: ok
        ? undefined
        : receiptRecord.currency !== REPORTABLE_CURRENCY
          ? BLOCKED_EXCHANGE_RATE_MESSAGE_HU
          : navResult?.error,
      submissions,
    });
  } catch (e) {
    return jsonResponse({ error: safeErrorMessage(e, "NAV submission failed.") }, 500);
  }
}
