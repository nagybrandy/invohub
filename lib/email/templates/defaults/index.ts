// lib/email/templates/defaults/index.ts
// Default email templates seeded for new users.
import type { EmailTemplateType } from "@/lib/email/templates/types";

export type DefaultTemplate = {
  type: EmailTemplateType;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplate[] = [
  {
    type: "invoice_notification",
    subject: "Invoice {{invoiceNumber}} from {{companyName}}",
    bodyHtml:
      "<p>Dear {{clientName}},</p><p>Please find your invoice <strong>{{invoiceNumber}}</strong> for {{total}}.</p><p>Due date: {{dueDate}}</p><p><a href=\"{{paymentLink}}\">Pay now</a></p>",
    bodyText:
      "Dear {{clientName}},\n\nInvoice {{invoiceNumber}} for {{total}}.\nDue: {{dueDate}}\nPay: {{paymentLink}}",
  },
  {
    type: "payment_reminder",
    subject: "Payment reminder: {{invoiceNumber}}",
    bodyHtml:
      "<p>Dear {{clientName}},</p><p>This is a reminder that invoice <strong>{{invoiceNumber}}</strong> ({{total}}) was due on {{dueDate}}.</p>",
    bodyText:
      "Dear {{clientName}},\n\nPayment reminder for invoice {{invoiceNumber}} ({{total}}). Due: {{dueDate}}.",
  },
  {
    type: "invoice_reminder",
    subject: "Invoice reminder: {{invoiceNumber}}",
    bodyHtml:
      "<p>Dear {{clientName}},</p><p>Reminder about invoice {{invoiceNumber}} for {{total}}.</p>",
    bodyText: "Dear {{clientName}},\n\nReminder: invoice {{invoiceNumber}} for {{total}}.",
  },
  {
    type: "receipt_notification",
    subject: "Receipt from {{companyName}}",
    bodyHtml: "<p>Dear {{clientName}},</p><p>Thank you for your payment of {{total}}.</p>",
    bodyText: "Dear {{clientName}},\n\nThank you for your payment of {{total}}.",
  },
  {
    type: "proforma_notification",
    subject: "Proforma invoice {{invoiceNumber}}",
    bodyHtml:
      "<p>Dear {{clientName}},</p><p>Proforma invoice {{invoiceNumber}} for {{total}}.</p>",
    bodyText: "Dear {{clientName}},\n\nProforma {{invoiceNumber}} for {{total}}.",
  },
  {
    type: "proforma_reminder",
    subject: "Proforma reminder: {{invoiceNumber}}",
    bodyHtml:
      "<p>Dear {{clientName}},</p><p>Reminder for proforma {{invoiceNumber}} ({{total}}).</p>",
    bodyText: "Dear {{clientName}},\n\nProforma reminder {{invoiceNumber}} ({{total}}).",
  },
];
