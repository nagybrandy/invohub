// lib/invoices/preview-html.ts
// Generates HTML preview for invoice modal display.
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";

export function generateInvoicePreviewHtml(invoice: Invoice): string {
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const rows = invoice.lineItems
    .map(
      (item) =>
        `<tr>
          <td>${escapeHtml(item.description)}</td>
          <td style="text-align:right">${item.quantity}</td>
          <td style="text-align:right">${formatCurrency(item.unitPrice, invoice.currency)}</td>
          <td style="text-align:right">${item.vatRate}%</td>
          <td style="text-align:right">${formatCurrency(item.quantity * item.unitPrice * (1 + item.vatRate / 100), invoice.currency)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber)}</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;color:#111">
  <h1 style="margin:0 0 8px">${escapeHtml(invoice.invoiceNumber)}</h1>
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
  <p style="color:#666;margin-top:24px">Issue: ${escapeHtml(invoice.issueDate)} · Due: ${escapeHtml(invoice.dueDate)}</p>
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
