// lib/invoices/send-error-i18n.ts
// Maps the machine-readable `code` that sendInvoiceNotificationEmail (and
// the invoice send API routes — app/api/invoices/[id]/send+api.ts,
// app/api/v1/invoices/[id]/send+api.ts, app/api/v1/invoices+api.ts's
// sendEmail:true path) return on failure to the i18n key with the matching
// Hungarian/English copy. The service/API layer intentionally keeps an
// English `error` string too (for server logs and external API consumers),
// but the UI must never show that raw string to the user — only this
// translated text. Shared by the invoice detail screen and the composer so
// the mapping (and the copy it points at) can't drift between the two.
export const SEND_INVOICE_ERROR_I18N_KEY: Record<string, string> = {
  invoiceNotFound: "invoices.detail.notFound",
  noRecipient: "invoices.errors.noRecipient",
  buyerAddressMissing: "invoices.errors.buyerAddressRequired",
  companyProfileIncomplete: "invoices.composer.companyProfileIncomplete",
  templateNotFound: "invoices.errors.templateNotFound",
  pdfFailed: "invoices.errors.pdfFailed",
  emailSendFailed: "invoices.errors.emailSendFailed",
};
