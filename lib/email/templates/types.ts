// lib/email/templates/types.ts
// Email template type identifiers matching Beta Backlog categories.
export const EMAIL_TEMPLATE_TYPES = [
  "invoice_notification",
  "payment_reminder",
  "invoice_reminder",
  "receipt_notification",
  "proforma_notification",
  "proforma_reminder",
] as const;

export type EmailTemplateType = (typeof EMAIL_TEMPLATE_TYPES)[number];

export type TemplateVariables = {
  invoiceNumber?: string;
  clientName?: string;
  total?: string;
  dueDate?: string;
  paymentLink?: string;
  companyName?: string;
};
