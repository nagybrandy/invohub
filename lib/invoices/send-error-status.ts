// lib/invoices/send-error-status.ts
// HTTP status for each sendInvoiceNotificationEmail failure `code`, shared
// by app/api/invoices/[id]/send+api.ts (session auth) and
// app/api/v1/invoices/[id]/send+api.ts (API-key auth) so the two routes
// can't drift on what status a given failure gets.
const STATUS_BY_CODE: Record<string, number> = {
  invoiceNotFound: 404,
  companyProfileIncomplete: 422,
  buyerAddressMissing: 422,
  noRecipient: 422,
  // Another request finalized the same draft first (atomic numbering).
  invoiceFinalized: 409,
  templateNotFound: 500,
  pdfFailed: 500,
  // 502: InvoHub's own request was fine, the downstream SMTP send failed.
  emailSendFailed: 502,
};

export function statusForSendFailure(result: { code?: string; error?: string }): number {
  if (result.code && STATUS_BY_CODE[result.code] !== undefined) {
    return STATUS_BY_CODE[result.code];
  }
  // Fallback for a failure with no `code` (older/uncovered path) — keeps
  // prior behavior instead of misreporting a 404 as a 500.
  if (result.error?.toLowerCase().includes("not found")) return 404;
  return 500;
}
