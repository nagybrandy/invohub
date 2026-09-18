// app/api/receipts/[id]/submit-nav+api.ts
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { navReceiptSubmission, receipt } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import { decryptNavSecretOrPassthrough } from "@/lib/nav/credentials";
import { parseNavReceiptEnvironment } from "@/lib/nav-receipt/environment";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import type { NavReceiptCredentials } from "@/lib/nav-receipt/types";
import { buildDailyReceiptReports } from "@/lib/receipts/daily-report";
import { getReceiptById, getReceiptsByDateRange } from "@/lib/receipts/service";

type Params = { id: string };

// AC1.3 / plan §1.3: non-HUF receipt days are refused, not guessed.
const BLOCKED_MESSAGE_HU =
  "Nem HUF nyugta: hiányzik az árfolyam, ezért nem küldhető be a NAV-nak.";

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
    if (!comp.taxNumber) {
      return jsonResponse({ error: "Company tax number required. Update company settings." }, 400);
    }

    const envMode = parseNavReceiptEnvironment(comp.navEnvironment);

    const issuedDate = new Date(receiptRecord.issuedAt);
    const dayStart = new Date(issuedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(issuedDate);
    dayEnd.setHours(23, 59, 59, 999);
    const applicableDate = dayStart.toISOString().slice(0, 10);

    const now = new Date();

    if (envMode === "demo") {
      // Demo mode never calls NAV — simulate acceptance for the submitted
      // receipt without aggregating the whole day.
      const submissionId = createId();
      await db.insert(navReceiptSubmission).values({
        id: submissionId,
        userId: session.user.id,
        companyId: comp.id,
        reportDate: applicableDate,
        status: "submitted",
        receiptCount: 1,
        transactionId: `RECEIPT-DEMO-${Date.now()}`,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.update(receipt).set({ navSubmitted: true, updatedAt: now }).where(eq(receipt.id, id));
      return jsonResponse({ ok: true, mode: "demo", reportDate: applicableDate });
    }

    if (!comp.navTechnicalUser || !comp.navTechnicalPassword || !comp.navXmlSignKey) {
      return jsonResponse(
        { error: "NAV credentials not configured. Update company settings." },
        400
      );
    }

    const dayReceipts = await getReceiptsByDateRange(session.user.id, dayStart, dayEnd);
    const { reports, blocked } = buildDailyReceiptReports(dayReceipts, {
      taxPayerId: comp.taxNumber,
      issuingSoftwareName: comp.navReceiptSoftwareId ?? "InvoHub",
      applicableDate,
      vatExempt: comp.vatExempt,
    });

    const credentials: NavReceiptCredentials = {
      technicalUser: comp.navTechnicalUser,
      technicalPassword: decryptNavSecretOrPassthrough(comp.navTechnicalPassword) ?? comp.navTechnicalPassword,
      signingKey: decryptNavSecretOrPassthrough(comp.navXmlSignKey) ?? comp.navXmlSignKey,
      taxNumber: comp.taxNumber,
    };

    const submissions: { ok: boolean; reportId?: string; error?: string }[] = [];
    let anyOk = false;

    for (const report of reports) {
      const submissionId = createId();
      const result = await submitReceiptDataReport(report, credentials, envMode);
      await db.insert(navReceiptSubmission).values({
        id: submissionId,
        userId: session.user.id,
        companyId: comp.id,
        reportDate: applicableDate,
        status: result.ok ? "submitted" : "failed",
        receiptCount: report.numberOfSaleDocument,
        transactionId: result.reportId ?? null,
        errorMessage: result.error ?? null,
        submittedAt: result.ok ? now : null,
        createdAt: now,
        updatedAt: now,
      });
      submissions.push({ ok: result.ok, reportId: result.reportId, error: result.error });
      if (result.ok) anyOk = true;
    }

    for (const group of blocked) {
      const submissionId = createId();
      await db.insert(navReceiptSubmission).values({
        id: submissionId,
        userId: session.user.id,
        companyId: comp.id,
        reportDate: applicableDate,
        status: "failed",
        receiptCount: group.receiptCount,
        errorMessage: BLOCKED_MESSAGE_HU,
        createdAt: now,
        updatedAt: now,
      });
      submissions.push({ ok: false, error: BLOCKED_MESSAGE_HU });
    }

    if (anyOk) {
      await db.update(receipt).set({ navSubmitted: true, updatedAt: now }).where(eq(receipt.id, id));
    }

    return jsonResponse({
      ok: anyOk,
      mode: envMode,
      reportDate: applicableDate,
      submissions,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NAV submission failed.";
    return jsonResponse({ error: message }, 500);
  }
}
