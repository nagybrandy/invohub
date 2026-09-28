// lib/email/templates/editor.ts
// What the visual e-mail editor needs beyond the renderer: sample values for
// the live preview, the placeholder list it can insert, an HTML → plain-text
// fallback for bodyText, and the preview document.
import { renderTemplate } from "@/lib/email/templates/render";
import type { TemplateVariables } from "@/lib/email/templates/types";

export const TEMPLATE_VARIABLE_KEYS = [
  "clientName",
  "invoiceNumber",
  "total",
  "dueDate",
  "paymentLink",
  "companyName",
] as const satisfies readonly (keyof TemplateVariables)[];

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLE_KEYS)[number];

/** Believable Hungarian sample data so the preview reads like a real mail. */
export const SAMPLE_VARIABLES: Required<TemplateVariables> = {
  clientName: "Minta Kft.",
  invoiceNumber: "INV-2026-00012",
  total: "127 000 Ft",
  dueDate: "2026. 10. 15.",
  paymentLink: "https://app.invohub.hu/pay/minta",
  companyName: "Az én vállalkozásom",
};

export function placeholder(key: TemplateVariableKey): string {
  return `{{${key}}}`;
}

/** The stored bodyText: the HTML with structure kept as line breaks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A complete, self-contained document for the preview frame. */
export function buildPreviewDocument(bodyHtml: string, variables: TemplateVariables = SAMPLE_VARIABLES): string {
  const rendered = renderTemplate(bodyHtml, variables);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:20px;font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;background:#fff}
a{color:#4f46e5} p{margin:0 0 12px} ul,ol{margin:0 0 12px 20px}
</style></head><body>${rendered}</body></html>`;
}
