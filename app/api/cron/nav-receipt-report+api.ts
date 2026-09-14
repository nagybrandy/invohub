// app/api/cron/nav-receipt-report+api.ts
// Only processes companies with an explicitly-entered navTechnicalUser
// (demo-mode companies, the default, have none and are excluded by the
// WHERE clause below). See lib/nav-receipt openIssue: the receipt-if/v1
// request/response shape here is not verified against an official NAV
// schema/sample — unlike lib/nav/ (invoice reporting).
import { eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { company, navReceiptSubmission } from "@/db/schema";
import { createId } from "@/lib/id";
import { decryptNavSecretOrPassthrough } from "@/lib/nav/credentials";
import { submitDailyReceiptReport } from "@/lib/nav-receipt/report";
import type { NavReceiptCredentials, NavReceiptEnvironment } from "@/lib/nav-receipt/types";
import { getDailyVatAggregation } from "@/lib/receipts/service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const reportDate = yesterday.toISOString().slice(0, 10);

  const companies = await db
    .select()
    .from(company)
    .where(isNotNull(company.navTechnicalUser));

  const results: { companyId: string; status: string; error?: string; transactionId?: string }[] = [];

  for (const comp of companies) {
    try {
      const aggregation = await getDailyVatAggregation(comp.userId, yesterday);

      if (aggregation.receiptCount === 0) {
        results.push({ companyId: comp.id, status: "skipped" });
        continue;
      }

      if (
        comp.navEnvironment === "demo" ||
        !comp.navTechnicalUser ||
        !comp.navTechnicalPassword ||
        !comp.navXmlSignKey ||
        !comp.taxNumber
      ) {
        results.push({ companyId: comp.id, status: "missing_credentials" });
        continue;
      }

      const submissionId = createId();
      const now = new Date();

      await db.insert(navReceiptSubmission).values({
        id: submissionId,
        userId: comp.userId,
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

      // navTechnicalPassword/navXmlSignKey are AES-256-GCM encrypted at rest
      // (lib/nav/credentials.ts) — decrypt before use; legacy plaintext rows
      // pass through unchanged.
      const credentials: NavReceiptCredentials = {
        technicalUser: comp.navTechnicalUser,
        technicalPassword: decryptNavSecretOrPassthrough(comp.navTechnicalPassword) ?? comp.navTechnicalPassword,
        signingKey: decryptNavSecretOrPassthrough(comp.navXmlSignKey) ?? comp.navXmlSignKey!,
        taxNumber: comp.taxNumber!,
      };
      const env: NavReceiptEnvironment = comp.navEnvironment === "production" ? "production" : "test";

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

      results.push({
        companyId: comp.id,
        status: finalStatus,
        transactionId: navResult.transactionId,
        error: navResult.error,
      });
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
