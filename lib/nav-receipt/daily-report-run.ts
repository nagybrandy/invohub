// lib/nav-receipt/daily-report-run.ts
// The NAV receipt-report cron's actual logic (app/api/cron/nav-receipt-report+api.ts
// is auth + delegation only, mirroring lib/reminders/process.ts). See
// docs/plans/2026-09-21-nav-receipt-report-cron-retry-backfill.md for the
// design: a bounded 3-day Budapest-calendar backfill window, per
// (companyId, reportDate) idempotency with retry-in-place, and a per-run
// submission cap.
import { eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { company, navReceiptSubmission } from "@/db/schema";
import { addBudapestDays, budapestDateKey, budapestDayRange } from "@/lib/dates/budapest";
import { createId } from "@/lib/id";
import { decryptNavSecretOrPassthrough } from "@/lib/nav/credentials";
import { submitDailyReceiptReport } from "@/lib/nav-receipt/report";
import type { NavReceiptCredentials, NavReceiptEnvironment } from "@/lib/nav-receipt/types";
import { getVatAggregationForRange, markReceiptsSubmittedForRange } from "@/lib/receipts/service";

/** Nyugtaadat-szolgáltatás may be delivered until the end of the 3rd calendar
 * day after the day in question — walking this many days back each run is
 * enough to recover from a two-night outage without ever reporting outside
 * the legal deadline. See plan §2.1. */
export const RECEIPT_REPORT_BACKFILL_DAYS = 3;

/** Keeps a single invocation inside its Vercel time budget as the user base
 * grows; the remaining pairs stay eligible for the next run. See plan §2.6. */
export const MAX_SUBMISSIONS_PER_RUN = 50;

/** Below this age, a `pending` row is assumed to be another run's
 * in-progress attempt rather than one that crashed — see plan §2.2. */
export const IN_FLIGHT_THRESHOLD_MS = 15 * 60 * 1000;

export type DailyReceiptReportResultStatus =
  | "submitted"
  | "failed"
  | "already_submitted"
  | "in_flight"
  | "skipped_no_receipts"
  | "missing_credentials";

export type DailyReceiptReportResultEntry = {
  companyId: string;
  reportDate: string;
  status: DailyReceiptReportResultStatus;
  transactionId?: string;
  error?: string;
  attemptCount?: number;
};

export type DailyReceiptReportRunResult = {
  ok: true;
  windowDays: number;
  reportDates: string[];
  companiesProcessed: number;
  submitted: number;
  failed: number;
  skipped: number;
  truncated: boolean;
  results: DailyReceiptReportResultEntry[];
};

type NavReceiptSubmissionRow = typeof navReceiptSubmission.$inferSelect;
type CompanyRow = typeof company.$inferSelect;

function hasCredentials(comp: CompanyRow): boolean {
  return !!(comp.navTechnicalUser && comp.navTechnicalPassword && comp.navXmlSignKey && comp.taxNumber);
}

function newestRowFor(rows: NavReceiptSubmissionRow[], reportDate: string): NavReceiptSubmissionRow | undefined {
  const forDate = rows.filter((r) => r.reportDate === reportDate);
  if (forDate.length === 0) return undefined;
  return forDate.reduce((newest, row) =>
    new Date(row.updatedAt).getTime() > new Date(newest.updatedAt).getTime() ? row : newest
  );
}

export async function runDailyReceiptReports(options?: {
  now?: Date;
  backfillDays?: number;
  maxSubmissions?: number;
}): Promise<DailyReceiptReportRunResult> {
  const now = options?.now ?? new Date();
  const backfillDays = options?.backfillDays ?? RECEIPT_REPORT_BACKFILL_DAYS;
  const maxSubmissions = options?.maxSubmissions ?? MAX_SUBMISSIONS_PER_RUN;

  const todayKey = budapestDateKey(now);
  const reportDates: string[] = [];
  for (let i = backfillDays; i >= 1; i--) {
    reportDates.push(addBudapestDays(todayKey, -i));
  }

  const companies = (await db
    .select()
    .from(company)
    .where(isNotNull(company.navTechnicalUser))) as CompanyRow[];

  const results: DailyReceiptReportResultEntry[] = [];
  let submitted = 0;
  let failed = 0;
  let skipped = 0;
  let submissionsAttempted = 0;
  let truncated = false;

  companyLoop: for (const comp of companies) {
    const existingRows = (await db
      .select()
      .from(navReceiptSubmission)
      .where(eq(navReceiptSubmission.companyId, comp.id))) as NavReceiptSubmissionRow[];

    for (const reportDate of reportDates) {
      if (submissionsAttempted >= maxSubmissions) {
        truncated = true;
        break companyLoop;
      }

      const newest = newestRowFor(existingRows, reportDate);

      if (newest?.status === "submitted") {
        results.push({ companyId: comp.id, reportDate, status: "already_submitted" });
        continue;
      }

      if (newest?.status === "pending") {
        const ageMs = now.getTime() - new Date(newest.updatedAt).getTime();
        if (ageMs < IN_FLIGHT_THRESHOLD_MS) {
          results.push({ companyId: comp.id, reportDate, status: "in_flight" });
          continue;
        }
        // Stale pending — treat exactly like a failed row: retry in place.
      }

      if (comp.navEnvironment === "demo" || !hasCredentials(comp)) {
        results.push({ companyId: comp.id, reportDate, status: "missing_credentials" });
        continue;
      }

      const { start, end } = budapestDayRange(reportDate);
      const aggregation = await getVatAggregationForRange(comp.userId, start, end, reportDate);

      if (aggregation.receiptCount === 0) {
        results.push({ companyId: comp.id, reportDate, status: "skipped_no_receipts" });
        skipped += 1;
        continue;
      }

      const attemptCount = (newest?.attemptCount ?? 0) + 1;
      const submissionId = newest?.id ?? createId();
      const vatBreakdownJson = JSON.stringify(aggregation.vatBreakdown);
      const startedAt = new Date();

      if (newest) {
        await db
          .update(navReceiptSubmission)
          .set({
            status: "pending",
            attemptCount,
            receiptCount: aggregation.receiptCount,
            startReceiptNumber: aggregation.startReceiptNumber ?? "",
            endReceiptNumber: aggregation.endReceiptNumber ?? "",
            vatBreakdown: vatBreakdownJson,
            updatedAt: startedAt,
          })
          .where(eq(navReceiptSubmission.id, submissionId));
      } else {
        await db.insert(navReceiptSubmission).values({
          id: submissionId,
          userId: comp.userId,
          companyId: comp.id,
          reportDate,
          status: "pending",
          attemptCount,
          receiptCount: aggregation.receiptCount,
          cancelledCount: 0,
          startReceiptNumber: aggregation.startReceiptNumber ?? "",
          endReceiptNumber: aggregation.endReceiptNumber ?? "",
          vatBreakdown: vatBreakdownJson,
          createdAt: startedAt,
          updatedAt: startedAt,
        });
      }

      submissionsAttempted += 1;

      // navTechnicalPassword/navXmlSignKey are AES-256-GCM encrypted at rest
      // (lib/nav/credentials.ts) — decrypt before use; legacy plaintext rows
      // pass through unchanged.
      const credentials: NavReceiptCredentials = {
        technicalUser: comp.navTechnicalUser!,
        technicalPassword:
          decryptNavSecretOrPassthrough(comp.navTechnicalPassword) ?? comp.navTechnicalPassword!,
        signingKey: decryptNavSecretOrPassthrough(comp.navXmlSignKey) ?? comp.navXmlSignKey!,
        taxNumber: comp.taxNumber!,
      };
      const env: NavReceiptEnvironment = comp.navEnvironment === "production" ? "production" : "test";

      try {
        const navResult = await submitDailyReceiptReport(
          {
            taxNumber: comp.taxNumber!,
            softwareId: comp.navReceiptSoftwareId ?? "INVOHUB-DEFAULT",
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

        const finalStatus = navResult.ok ? "submitted" : "failed";
        const finishedAt = new Date();

        await db
          .update(navReceiptSubmission)
          .set({
            status: finalStatus,
            transactionId: navResult.transactionId ?? null,
            errorMessage: navResult.error ?? null,
            submittedAt: navResult.ok ? finishedAt : null,
            updatedAt: finishedAt,
          })
          .where(eq(navReceiptSubmission.id, submissionId));

        if (navResult.ok) {
          await markReceiptsSubmittedForRange(comp.userId, start, end);
          submitted += 1;
        } else {
          failed += 1;
        }

        results.push({
          companyId: comp.id,
          reportDate,
          status: finalStatus,
          transactionId: navResult.transactionId,
          error: navResult.error,
          attemptCount,
        });
      } catch (e) {
        // Never leave the row stuck "pending" — a thrown error (NAV
        // timeout, network failure, …) must still resolve to "failed" so a
        // later run's retry-in-place picks it up. One company's outage
        // must not skip the next company or date.
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        const finishedAt = new Date();

        await db
          .update(navReceiptSubmission)
          .set({
            status: "failed",
            errorMessage: errorMsg,
            updatedAt: finishedAt,
          })
          .where(eq(navReceiptSubmission.id, submissionId));

        failed += 1;
        results.push({
          companyId: comp.id,
          reportDate,
          status: "failed",
          error: errorMsg,
          attemptCount,
        });
      }
    }
  }

  return {
    ok: true,
    windowDays: backfillDays,
    reportDates,
    companiesProcessed: companies.length,
    submitted,
    failed,
    skipped,
    truncated,
    results,
  };
}
