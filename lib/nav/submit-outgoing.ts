// lib/nav/submit-outgoing.ts
// Shared NAV outgoing invoice submission: builds OSA 3.0 InvoiceData XML,
// submits it through the mode-appropriate client (demo simulator, or the
// real test/production client), and records the submission + transactionId.
import { db } from "@/db";
import { navSubmission } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import type { Invoice } from "@/lib/invoices/types";
import { getNavClient } from "@/lib/nav/client";
import type { NavEnvironment } from "@/lib/nav/environment";
import { buildNavInvoiceXml } from "@/lib/nav/invoice-xml";
import { resolveNavCredentials } from "@/lib/nav/resolve-credentials";
import type { NavInvoiceOperationKind } from "@/lib/nav/types";

/**
 * documentType "storno" -> NAV STORNO, "modify" -> NAV MODIFY, everything
 * else (invoice/proforma/advance) -> CREATE. Note: the XML body itself
 * still doesn't carry the <invoiceReferenceData> block NAV requires to
 * validate a MODIFY/STORNO submission — see the "Known simplifications"
 * note at the top of lib/nav/invoice-xml.ts.
 */
function resolveNavOperation(documentType: Invoice["documentType"]): NavInvoiceOperationKind {
  if (documentType === "storno") return "STORNO";
  if (documentType === "modify") return "MODIFY";
  return "CREATE";
}

export type NavSubmissionResult = {
  submissionId: string;
  status: string;
  transactionId: string;
  invoiceXml: string;
  mode: NavEnvironment;
};

export async function submitOutgoingInvoiceToNav(
  userId: string,
  invoice: Invoice
): Promise<NavSubmissionResult> {
  const company = await getCompanyByUserId(userId);
  const mode: NavEnvironment = company?.navEnvironment ?? "demo";

  const invoiceXml = buildNavInvoiceXml(invoice, company);
  const invoiceDataBase64 = Buffer.from(invoiceXml, "utf8").toString("base64");

  const client = getNavClient(mode);
  const credentials = mode === "demo" ? null : resolveNavCredentials(company);

  const operation = resolveNavOperation(invoice.documentType);
  const { exchangeToken } = await client.tokenExchange(credentials);
  const { transactionId } = await client.manageInvoice(credentials, exchangeToken, [
    { index: 1, operation, invoiceDataBase64 },
  ]);

  const now = new Date();
  const submissionId = createId();
  const status = "sent";

  await db.insert(navSubmission).values({
    id: submissionId,
    invoiceId: invoice.id,
    status,
    mode,
    transactionId,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return { submissionId, status, transactionId, invoiceXml, mode };
}
