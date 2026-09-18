// app/api/cron/nav-receipt-report+api.ts
// "test" mode only — demo (the default company.navEnvironment) is skipped by
// construction, and this repo must never invoke a NAV production
// environment from a cron job (see CLAUDE.md "NAV modes").
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { company, navReceiptSubmission } from "@/db/schema";
import { createId } from "@/lib/id";
import { decryptNavSecretOrPassthrough } from "@/lib/nav/credentials";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import type { NavReceiptCredentials, NavReceiptEnvironment } from "@/lib/nav-receipt/types";
import { buildDailyReceiptReports } from "@/lib/receipts/daily-report";
import { getReceiptsByDateRange } from "@/lib/receipts/service";

const BLOCKED_MESSAGE_HU =
  "Nem HUF nyugta: hiányzik az árfolyam, ezért nem küldhető be a NAV-nak.";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: without a configured secret, nothing can authenticate this route.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(yesterday);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(yesterday);
  dayEnd.setHours(23, 59, 59, 999);
  const reportDate = dayStart.toISOString().slice(0, 10);

  const companies = await db.select().from(company).where(eq(company.navEnvironment, "test"));

  const results: { companyId: string; status: string; error?: string }[] = [];

  for (const comp of companies) {
    try {
      if (!comp.taxNumber || !comp.navTechnicalUser || !comp.navTechnicalPassword || !comp.navXmlSignKey) {
        results.push({ companyId: comp.id, status: "missing_credentials" });
        continue;
      }

      const dayReceipts = await getReceiptsByDateRange(comp.userId, dayStart, dayEnd);
      const { reports, blocked } = buildDailyReceiptReports(dayReceipts, {
        taxPayerId: comp.taxNumber,
        issuingSoftwareName: comp.navReceiptSoftwareId ?? "InvoHub",
        applicableDate: reportDate,
        vatExempt: comp.vatExempt,
      });

      if (reports.length === 0 && blocked.length === 0) {
        results.push({ companyId: comp.id, status: "skipped" });
        continue;
      }

      // navTechnicalPassword/navXmlSignKey are AES-256-GCM encrypted at rest
      // (lib/nav/credentials.ts) — decrypt before use; legacy plaintext rows
      // pass through unchanged.
      const credentials: NavReceiptCredentials = {
        technicalUser: comp.navTechnicalUser,
        technicalPassword: decryptNavSecretOrPassthrough(comp.navTechnicalPassword) ?? comp.navTechnicalPassword,
        signingKey: decryptNavSecretOrPassthrough(comp.navXmlSignKey) ?? comp.navXmlSignKey,
        taxNumber: comp.taxNumber,
      };
      const env: NavReceiptEnvironment = "test";
      const now = new Date();

      for (const report of reports) {
        const submissionId = createId();
        const result = await submitReceiptDataReport(report, credentials, env);
        await db.insert(navReceiptSubmission).values({
          id: submissionId,
          userId: comp.userId,
          companyId: comp.id,
          reportDate,
          status: result.ok ? "submitted" : "failed",
          receiptCount: report.numberOfSaleDocument,
          transactionId: result.reportId ?? null,
          errorMessage: result.error ?? null,
          submittedAt: result.ok ? now : null,
          createdAt: now,
          updatedAt: now,
        });
        results.push({
          companyId: comp.id,
          status: result.ok ? "submitted" : "failed",
          error: result.error,
        });
      }

      for (const group of blocked) {
        const submissionId = createId();
        await db.insert(navReceiptSubmission).values({
          id: submissionId,
          userId: comp.userId,
          companyId: comp.id,
          reportDate,
          status: "failed",
          receiptCount: group.receiptCount,
          errorMessage: BLOCKED_MESSAGE_HU,
          createdAt: now,
          updatedAt: now,
        });
        results.push({ companyId: comp.id, status: "failed", error: BLOCKED_MESSAGE_HU });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      results.push({ companyId: comp.id, status: "error", error: errorMsg });
    }
  }

  return Response.json({
    ok: true,
    reportDate,
    companiesProcessed: companies.length,
    results,
  });
}
