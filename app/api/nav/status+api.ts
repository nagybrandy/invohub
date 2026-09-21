// app/api/nav/status+api.ts
// Poll/refresh NAV transaction status for an invoice's latest submission —
// backs the "Státusz frissítése" action on the invoice detail screen.
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { navSubmission } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getCompanyByUserId } from "@/lib/companies/service";
import { getInvoiceById } from "@/lib/invoices/service";
import { getNavClient } from "@/lib/nav/client";
import { isNavEnvironment, type NavEnvironment } from "@/lib/nav/environment";
import { buildNavExchangeRateAudit, type NavSubmissionAudit } from "@/lib/nav/reported-rate";
import { resolveNavCredentials } from "@/lib/nav/resolve-credentials";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const invoiceId = url.searchParams.get("invoiceId");
  if (!invoiceId) return jsonResponse({ error: "invoiceId query param required." }, 400);

  const invoice = await getInvoiceById(session.user.id, invoiceId);
  if (!invoice) return jsonResponse({ error: "Invoice not found." }, 404);

  const submissions = await db
    .select()
    .from(navSubmission)
    .where(eq(navSubmission.invoiceId, invoice.id))
    .orderBy(desc(navSubmission.createdAt));

  // Sources the reported HUF VAT figure from the winning submission's
  // persisted nav_submission.reportedVatHuf column when present, rather
  // than only recomputing it from the invoice's current (mutable) line
  // items — see lib/nav/reported-rate.ts#buildNavExchangeRateAudit.
  const exchangeRateReport = buildNavExchangeRateAudit(invoice, submissions as NavSubmissionAudit[]);

  return jsonResponse({ submissions, exchangeRateReport });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { invoiceId?: string };
  if (!body.invoiceId) return jsonResponse({ error: "invoiceId required." }, 400);

  const invoice = await getInvoiceById(session.user.id, body.invoiceId);
  if (!invoice) return jsonResponse({ error: "Invoice not found." }, 404);

  const [submission] = await db
    .select()
    .from(navSubmission)
    .where(eq(navSubmission.invoiceId, invoice.id))
    .orderBy(desc(navSubmission.createdAt))
    .limit(1);

  if (!submission || !submission.transactionId) {
    return jsonResponse({ error: "Ehhez a számlához nincs NAV beküldés." }, 404);
  }

  const company = await getCompanyByUserId(session.user.id);
  const mode: NavEnvironment = isNavEnvironment(submission.mode) ? submission.mode : company?.navEnvironment ?? "demo";

  try {
    const client = getNavClient(mode);
    const credentials = mode === "demo" ? null : resolveNavCredentials(company);
    const result = await client.queryTransactionStatus(credentials, submission.transactionId);

    const now = new Date();
    await db
      .update(navSubmission)
      .set({
        status: result.status.toLowerCase(),
        messages: JSON.stringify(result.messages),
        checkedAt: now,
        updatedAt: now,
      })
      .where(eq(navSubmission.id, submission.id));

    return jsonResponse({
      transactionId: result.transactionId,
      status: result.status,
      messages: result.messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "NAV státusz lekérdezés sikertelen.";
    return jsonResponse({ error: message }, 502);
  }
}
