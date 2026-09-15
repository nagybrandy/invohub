// lib/invoices/preview-html.ts
// Generates HTML preview for invoice modal display.
import {
  calculateInvoiceTotals,
  formatCurrency,
  lineItemGrossTotal,
  lineItemVatAmount,
} from "@/lib/invoices/calculations";
import { formatExchangeRate, requiresExchangeRate, resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import {
  formatInvoiceDueDate,
  formatInvoiceIssueDateTime,
} from "@/lib/dates/format";
import type { Invoice } from "@/lib/invoices/types";

export function generateInvoicePreviewHtml(invoice: Invoice): string {
  const totals = calculateInvoiceTotals(invoice.lineItems);

  // AC14: a non-HUF invoice shows the rate it was converted at plus the VAT
  // total in forint next to the document-currency VAT — Áfa tv.'s "currency,
  // and the exchange rate if not HUF" requirement
  // (.claude/skills/hu-invoicing-rules/SKILL.md). Wording is plain-language,
  // not verified legal text — see plan OQ-3. Rendered only when a usable
  // rate resolves; buildNavInvoiceXml is what refuses to submit without one,
  // this preview should still render for an in-progress draft.
  const rateResolution = requiresExchangeRate(invoice.currency) ? resolveExchangeRate(invoice) : null;
  const exchangeRateHtml =
    rateResolution && rateResolution.ok
      ? (() => {
          const rate = rateResolution.rate;
          // Convert per line, then sum the rounded HUF values (same rule as
          // the NAV XML builder, lib/nav/invoice-xml.ts) rather than
          // converting the already-summed document-currency VAT total.
          const vatTotalHuf = invoice.lineItems.reduce(
            (sum, item) => sum + toHufAmount(lineItemVatAmount(item), rate),
            0
          );
          // Display rate uses a comma decimal separator (Hungarian
          // convention) — distinct from formatExchangeRate's "." output,
          // which is for the NAV XML, not for a human-facing document.
          const displayRate = formatExchangeRate(rate).replace(".", ",");
          return `
  <div style="text-align:right;color:#444">
    <p>Exchange rate: 1 ${escapeHtml(invoice.currency)} = ${displayRate} HUF</p>
    <p>VAT amount in HUF: ${formatCurrency(vatTotalHuf, "HUF")}</p>
  </div>`;
        })()
      : "";
  const rows = invoice.lineItems
    .map(
      (item) =>
        `<tr>
          <td>${escapeHtml(item.description)}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td style="text-align:right">${formatCurrency(item.unitPrice, invoice.currency)}</td>
          <td style="text-align:right">${item.vatCategory === "normal" ? `${item.vatRate}%` : escapeHtml(item.vatCategory)}</td>
          <td style="text-align:right">${formatCurrency(lineItemGrossTotal(item), invoice.currency)}</td>
        </tr>`
    )
    .join("");

  const exemptionReasons = [
    ...new Set(
      invoice.lineItems
        .filter((item) => item.vatCategory !== "normal")
        .map((item) => resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason))
        .filter((reason): reason is string => !!reason)
    ),
  ];

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber || "DRAFT")}</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#111">
  <h1 style="margin:0 0 8px">${escapeHtml(invoice.invoiceNumber || "DRAFT")}</h1>
  <p style="color:#666;margin:0 0 24px">Status: ${escapeHtml(invoice.status)}</p>
  <section style="margin-bottom:24px">
    <strong>Bill to:</strong> ${escapeHtml(invoice.clientName)}
    ${invoice.clientTaxNumber ? `<br><span style="color:#666">Tax: ${escapeHtml(invoice.clientTaxNumber)}</span>` : ""}
  </section>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="border-bottom:2px solid #eee;text-align:left">
        <th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">VAT</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="text-align:right">
    <p>Subtotal: ${formatCurrency(totals.subtotal, invoice.currency)}</p>
    <p>VAT: ${formatCurrency(totals.vatTotal, invoice.currency)}</p>
    <p><strong>Total: ${formatCurrency(totals.totalAmount, invoice.currency)}</strong></p>
  </div>
  ${exchangeRateHtml}
  ${exemptionReasons.length > 0 ? `<p style="color:#444">${exemptionReasons.map(escapeHtml).join("<br>")}</p>` : ""}
  <p style="color:#666;margin-top:24px">Issue: ${escapeHtml(formatInvoiceIssueDateTime(invoice))} · Due: ${escapeHtml(formatInvoiceDueDate(invoice))}</p>
  ${invoice.notes ? `<p style="margin-top:16px">${escapeHtml(invoice.notes)}</p>` : ""}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
