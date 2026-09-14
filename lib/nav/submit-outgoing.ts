// lib/nav/submit-outgoing.ts
// Shared NAV outgoing invoice submission: builds OSA 3.0 InvoiceData XML,
// submits it through the mode-appropriate client (demo simulator, or the
// real test/production client), and records the submission + transactionId.
import { db } from "@/db";
import { navSubmission } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import { getInvoiceById } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";
import { getNavClient } from "@/lib/nav/client";
import type { NavEnvironment } from "@/lib/nav/environment";
import { buildNavInvoiceXml, type NavInvoiceReference } from "@/lib/nav/invoice-xml";
import { resolveNavCredentials } from "@/lib/nav/resolve-credentials";
import { hasSuccessfulNavSubmission } from "@/lib/nav/submission-history";
import type { NavInvoiceOperationKind } from "@/lib/nav/types";

/**
 * documentType "storno" -> NAV STORNO, "modify" -> NAV MODIFY, everything
 * else (invoice/proforma/advance) -> CREATE.
 */
function resolveNavOperation(documentType: Invoice["documentType"]): NavInvoiceOperationKind {
  if (documentType === "storno") return "STORNO";
  if (documentType === "modify") return "MODIFY";
  return "CREATE";
}

/**
 * Resolves the <invoiceReference> block for a storno/helyesbítő document:
 * looks up the invoice it references (by number, not id — that's what NAV
 * needs) and whether that original was ever actually reported to NAV.
 * Returns null for a plain CREATE (invoice/proforma/advance).
 */
async function resolveInvoiceReference(
  userId: string,
  invoice: Invoice
): Promise<NavInvoiceReference | null> {
  const referencedId =
    invoice.documentType === "storno"
      ? invoice.originalInvoiceId
      : invoice.documentType === "modify"
        ? invoice.modifiesInvoiceId
        : undefined;
  if (!referencedId) {
    if (invoice.documentType === "storno" || invoice.documentType === "modify") {
      throw new Error(
        `NAV ${invoice.documentType} submission for invoice ${invoice.id} is missing its reference to the original invoice.`
      );
    }
    return null;
  }

  const original = await getInvoiceById(userId, referencedId);
  if (!original || !original.invoiceNumber) {
    throw new Error(
      `NAV ${invoice.documentType} submission for invoice ${invoice.id}: referenced original invoice ${referencedId} was not found or has no invoice number.`
    );
  }

  const wasExchanged = await hasSuccessfulNavSubmission(original.id);

  return {
    originalInvoiceNumber: original.invoiceNumber,
    modifyWithoutMaster: !wasExchanged,
    modificationIndex: invoice.modificationIndex ?? 1,
  };
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

  const invoiceReference = await resolveInvoiceReference(userId, invoice);
  const invoiceXml = buildNavInvoiceXml(
    invoiceReference ? { ...invoice, invoiceReference } : invoice,
    company
  );
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
