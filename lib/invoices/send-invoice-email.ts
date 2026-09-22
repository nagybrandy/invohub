// lib/invoices/send-invoice-email.ts
// Sends invoice notification email with PDF attachment.
import { getCompanyByUserId, resolveInvoiceEmailRecipients } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { normalizeEmailList } from "@/lib/email/recipients";
import { resolveSenderIdentity } from "@/lib/email/sender";
import { renderTemplate } from "@/lib/email/templates/render";
import { getEmailTemplateByType } from "@/lib/email/templates/service";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { invoicePdfFilename } from "@/lib/invoices/generate-pdf";
import { buildInvoicePdfForUser } from "@/lib/invoices/invoice-pdf";
import { CompanyProfileIncompleteError, getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import { hasBuyerAddress, requiresCompleteBuyerAddress, type Invoice } from "@/lib/invoices/types";
import { autoSubmitToNavOnFinalize } from "@/lib/nav/auto-submit";

export type SendInvoiceEmailResult = {
  ok: boolean;
  error?: string;
  /** Machine-readable code for a known failure — e.g. "companyProfileIncomplete". */
  code?: string;
  missingFields?: string[];
  to?: string[];
  cc?: string[];
  invoice?: Invoice;
  pdfAttached?: boolean;
};

function parseCcList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function sendInvoiceNotificationEmail(
  userId: string,
  invoiceId: string,
  options?: {
    to?: string | string[];
    cc?: string | string[];
    templateType?: string;
    markSent?: boolean;
  }
): Promise<SendInvoiceEmailResult> {
  let invoice = await getInvoiceById(userId, invoiceId);
  if (!invoice) {
    return { ok: false, error: "Invoice not found.", code: "invoiceNotFound" };
  }

  // Everything that can make the send fail must be checked BEFORE the draft
  // is finalized — otherwise a failed send still burns an invoice number
  // (sorszám), which can never be reused.
  const to = await resolveInvoiceEmailRecipients(userId, invoice.clientName, options?.to);
  if (to.length === 0) {
    return {
      ok: false,
      error:
        "No invoice email recipient configured. Set a default in Company profile or provide emailTo.",
      code: "noRecipient",
    };
  }

  const finalizing = options?.markSent !== false && invoice.status === "draft";
  // Áfa tv. 169. § e) — same gate as every other finalize path.
  if (finalizing && requiresCompleteBuyerAddress({ ...invoice, status: "sent" }) && !hasBuyerAddress(invoice)) {
    return {
      ok: false,
      error: "Buyer name and address (clientZipCode, clientCity, clientAddress) are required to finalize an invoice.",
      code: "buyerAddressMissing",
    };
  }

  // Finalize (assign the real invoice number) BEFORE building the PDF/email
  // vars below — otherwise a still-draft invoice would be emailed with a
  // blank invoiceNumber and only get its number afterwards.
  if (finalizing) {
    const draft = invoice;
    try {
      invoice = await upsertInvoice(userId, {
        ...invoice,
        status: "sent",
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof CompanyProfileIncompleteError) {
        return {
          ok: false,
          error: "Company profile is incomplete.",
          code: "companyProfileIncomplete",
          missingFields: error.missingFields,
        };
      }
      throw error;
    }
    // This IS a finalization (the draft just got its number): report it to
    // NAV like every other finalization path. Never throws — a NAV problem
    // is recorded on the submission row, the email still goes out.
    await autoSubmitToNavOnFinalize(userId, draft, invoice);
  }

  const template = await getEmailTemplateByType(
    userId,
    (options?.templateType as "invoice_notification") ?? "invoice_notification"
  );
  if (!template) {
    return { ok: false, error: "Invoice email template not found.", code: "templateNotFound" };
  }

  const pdfResult = await buildInvoicePdfForUser(userId, invoiceId);
  if (!pdfResult) {
    return { ok: false, error: "Failed to generate PDF.", code: "pdfFailed" };
  }

  const company = await getCompanyByUserId(userId);
  const sender = await resolveSenderIdentity(userId, company);
  const ccOverride = options?.cc !== undefined ? normalizeEmailList(options.cc) : undefined;
  const cc = ccOverride ?? parseCcList(company?.invoiceEmailCc);
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const vars = {
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    total: formatCurrency(totals.totalAmount, invoice.currency),
    dueDate: invoice.dueDate,
    paymentLink: "",
    companyName: company?.name ?? "InvoHub",
  };

  const result = await sendEmail({
    to,
    subject: renderTemplate(template.subject, vars),
    html: renderTemplate(template.bodyHtml, vars),
    text: renderTemplate(template.bodyText ?? template.bodyHtml, vars),
    attachments: [
      {
        filename: invoicePdfFilename(pdfResult.invoiceNumber),
        content: pdfResult.pdf,
        contentType: "application/pdf",
      },
    ],
    cc: cc.length > 0 ? cc : undefined,
    fromName: sender.fromName,
    replyTo: sender.replyTo,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, code: "emailSendFailed", to, cc };
  }

  return { ok: true, to, cc, invoice, pdfAttached: true };
}
