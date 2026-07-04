// lib/invoices/invoice-pdf.ts
// Shared helper to build PDF bytes for an authenticated user's invoice.
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { getInvoiceById } from "@/lib/invoices/service";

export async function buildInvoicePdfForUser(
  userId: string,
  invoiceId: string
): Promise<{ pdf: Buffer; invoiceNumber: string } | null> {
  const invoice = await getInvoiceById(userId, invoiceId);
  if (!invoice) return null;

  const ctx = await buildInvoicePdfContext(userId, invoice);
  const pdf = await generateInvoicePdf(ctx);

  return { pdf, invoiceNumber: invoice.invoiceNumber };
}
