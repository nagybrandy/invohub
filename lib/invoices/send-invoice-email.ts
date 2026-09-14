// lib/invoices/send-invoice-email.ts
// Sends invoice notification email with PDF attachment.
import { getCompanyByUserId, resolveInvoiceEmailRecipients } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { normalizeEmailList } from "@/lib/email/recipients";
import { renderTemplate } from "@/lib/email/templates/render";
import { getEmailTemplateByType } from "@/lib/email/templates/service";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { invoicePdfFilename } from "@/lib/invoices/generate-pdf";
import { buildInvoicePdfForUser } from "@/lib/invoices/invoice-pdf";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

export type SendInvoiceEmailResult = {
  ok: boolean;
  error?: string;
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
    return { ok: false, error: "Invoice not found." };
  }

  // Finalize (assign the real invoice number) BEFORE building the PDF/email
  // vars below — otherwise a still-draft invoice would be emailed with a
  // blank invoiceNumber and only get its number afterwards.
  if (options?.markSent !== false && invoice.status === "draft") {
    invoice = await upsertInvoice(userId, {
      ...invoice,
      status: "sent",
      updatedAt: new Date().toISOString(),
    });
  }

  const to = await resolveInvoiceEmailRecipients(userId, invoice.clientName, options?.to);
  if (to.length === 0) {
    return {
      ok: false,
      error:
        "No invoice email recipient configured. Set a default in Company profile or provide emailTo.",
    };
  }

  const template = await getEmailTemplateByType(
    userId,
    (options?.templateType as "invoice_notification") ?? "invoice_notification"
  );
  if (!template) {
    return { ok: false, error: "Invoice email template not found." };
  }

  const pdfResult = await buildInvoicePdfForUser(userId, invoiceId);
  if (!pdfResult) {
    return { ok: false, error: "Failed to generate PDF." };
  }

  const company = await getCompanyByUserId(userId);
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
  });

  if (!result.ok) {
    return { ok: false, error: result.error, to, cc };
  }

  return { ok: true, to, cc, invoice, pdfAttached: true };
}
