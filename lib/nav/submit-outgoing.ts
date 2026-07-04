// lib/nav/submit-outgoing.ts
// Shared NAV outgoing invoice submission (XML build + DB record).
import { db } from "@/db";
import { navSubmission } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { createId } from "@/lib/id";
import type { Invoice } from "@/lib/invoices/types";
import { submitInvoiceToNav } from "@/lib/nav/client";
import { buildNavInvoiceXml } from "@/lib/nav/invoice-xml";

export type NavSubmissionResult = {
  submissionId: string;
  status: string;
  transactionId: string;
  invoiceXml: string;
};

export async function submitOutgoingInvoiceToNav(
  userId: string,
  invoice: Invoice
): Promise<NavSubmissionResult> {
  const company = await getCompanyByUserId(userId);
  const invoiceXml = buildNavInvoiceXml(invoice, company);

  const result = await submitInvoiceToNav(
    {
      technicalUser: company?.navTechnicalUser ?? "sandbox",
      xmlSignKey: company?.navXmlSignKey ?? "sandbox",
      taxNumber: company?.taxNumber ?? "00000000-0-00",
    },
    invoiceXml
  );

  const now = new Date();
  const submissionId = createId();

  await db.insert(navSubmission).values({
    id: submissionId,
    invoiceId: invoice.id,
    status: result.status,
    transactionId: result.transactionId,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    submissionId,
    status: result.status,
    transactionId: result.transactionId,
    invoiceXml,
  };
}
