// lib/invoices/preview-html.ts
// Generates the branded, Hungarian HTML preview for an invoice — the same
// document a Hungarian customer receives (see
// docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md). The
// document is ALWAYS Hungarian by default, independent of the app UI's
// language — pass `locale: "en"` for the rare case an English rendering is
// wanted.
import {
  calculateInvoiceTotals,
  lineItemGrossTotal,
  lineItemNetTotal,
  lineItemVatAmount,
} from "@/lib/invoices/calculations";
import {
  documentLabels,
  documentStatusChip,
  documentTitleFor,
  formatDocumentAmount,
  type DocumentLabels,
  type DocumentLocale,
} from "@/lib/invoices/document-labels";
import { formatExchangeRate, requiresExchangeRate, resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import { normalizeHexColor } from "@/lib/invoices/pdf-template/defaults";
import { brandMarkSvg } from "@/components/marketing/brand-mark-svg";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import {
  formatInvoiceDueDate,
  formatInvoiceIssueDateTime,
} from "@/lib/dates/format";
import type { InvoicePdfCompany } from "@/lib/invoices/generate-pdf";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import type { Invoice, PaymentMethod } from "@/lib/invoices/types";

export type InvoicePreviewOptions = {
  /** The signed-in user's own company — printed under "Kibocsátó". Omit for an unsaved draft with no company loaded yet. */
  company?: InvoicePdfCompany;
  /** Only accentColor is used today (the header/table stay navy/cornflower); reserved for the rest of the template. */
  template?: InvoicePdfTemplate;
  locale?: DocumentLocale;
};

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function companyBlockHtml(company: InvoicePdfCompany, labels: DocumentLabels): string {
  const addressLine = [company.address, company.city, company.zipCode, company.country]
    .filter(Boolean)
    .join(", ");

  return [
    `<p class="party-name">${escapeHtml(company.name)}</p>`,
    company.taxNumber
      ? `<p>${escapeHtml(labels.taxNumber)}: ${escapeHtml(company.taxNumber)}</p>`
      : "",
    addressLine ? `<p>${escapeHtml(addressLine)}</p>` : "",
    company.bankAccount
      ? `<p>${escapeHtml(labels.bankAccount)}: ${escapeHtml(company.bankAccount)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function generateInvoicePreviewHtml(
  invoice: Invoice,
  options: InvoicePreviewOptions = {}
): string {
  const locale = options.locale ?? "hu";
  const labels = documentLabels(locale);
  const company = options.company;
  // Interpolated straight into a <style> block below — escapeHtml only
  // escapes & < > " ', not ; } / * or whitespace, so it can't stop CSS
  // injection on its own. normalizeHexColor guarantees a strict
  // #rrggbb-shaped value (or the default), closing the injection vector
  // outright instead of merely reducing it.
  const accent = normalizeHexColor(options.template?.accentColor?.trim() || "#6495ed");

  const totals = calculateInvoiceTotals(invoice.lineItems);
  const documentNumber = invoice.invoiceNumber || labels.draftNumber;
  const documentTitle = documentTitleFor(invoice.documentType, locale);
  const statusChip = documentStatusChip(invoice.status, locale);

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
          const rateLine = labels.exchangeRateValue
            .replace("{{currency}}", invoice.currency)
            .replace("{{rate}}", displayRate);
          return `
      <span class="exchange-rate-note">${escapeHtml(labels.exchangeRate)}: ${escapeHtml(rateLine)}</span>
      <span class="exchange-rate-note">${escapeHtml(labels.vatInHuf)}: ${formatDocumentAmount(vatTotalHuf, "HUF")}</span>`;
        })()
      : "";

  const rows = invoice.lineItems
    .map((item) => {
      const net = lineItemNetTotal(item);
      const vatAmount = lineItemVatAmount(item);
      const gross = lineItemGrossTotal(item);
      // Non-"normal" categories are always 0% VAT (see isExemptVatCategory) — the
      // VAT column prints the bare category code, not a redundant "0 Ft" amount.
      const vatCell =
        item.vatCategory === "normal"
          ? `${item.vatRate}% · ${formatDocumentAmount(vatAmount, invoice.currency)}`
          : escapeHtml(item.vatCategory);

      return `<tr>
          <td class="cell-desc" data-label="${escapeHtml(labels.description)}">${escapeHtml(item.description)}</td>
          <td class="cell-num" data-label="${escapeHtml(labels.quantity)}">${item.quantity}</td>
          <td class="cell-num" data-label="${escapeHtml(labels.unitPrice)}">${formatDocumentAmount(item.unitPrice, invoice.currency)}</td>
          <td class="cell-num" data-label="${escapeHtml(labels.net)}">${formatDocumentAmount(net, invoice.currency)}</td>
          <td class="cell-num" data-label="${escapeHtml(labels.vat)}">${vatCell}</td>
          <td class="cell-num" data-label="${escapeHtml(labels.gross)}">${formatDocumentAmount(gross, invoice.currency)}</td>
        </tr>`;
    })
    .join("");

  const exemptionReasons = [
    ...new Set(
      invoice.lineItems
        .filter((item) => item.vatCategory !== "normal")
        .map((item) => resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason))
        .filter((reason): reason is string => !!reason)
    ),
  ];

  const paymentMethodLabel = invoice.paymentMethod
    ? labels.paymentMethods[invoice.paymentMethod as PaymentMethod]
    : null;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(documentTitle)} ${escapeHtml(documentNumber)}</title>
<style>
  :root { --navy: #111f4a; --cornflower: ${escapeHtml(accent)}; --mist: #edf2fa; --pale-blue: #d9e7ff; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: #f2f4f9; color: #14162b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .page { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(17, 31, 74, 0.12); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .issuer-identity { display: flex; align-items: center; gap: 12px; }
  .badge { width: 48px; height: 48px; border-radius: 10px; background: var(--cornflower); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
  .issuer-identity .party-name { margin: 0; font-weight: 700; color: var(--navy); font-size: 1.05rem; }
  .doc-meta { text-align: right; }
  .doc-title { margin: 0; color: var(--navy); font-weight: 700; font-size: 1.4rem; }
  .doc-number { margin: 4px 0; color: #4a4f6a; font-variant-numeric: tabular-nums; }
  .status-chip { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--pale-blue); color: var(--navy); font-size: 0.78rem; font-weight: 600; }
  .parties { display: flex; gap: 16px; margin-bottom: 24px; }
  .parties-single { max-width: 50%; }
  .party-card { flex: 1; min-width: 0; background: var(--mist); border-radius: 10px; padding: 16px; }
  .party-card h2 { margin: 0 0 8px; color: var(--navy); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .party-card p { margin: 2px 0; font-size: 0.9rem; }
  .party-name { font-weight: 600; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 24px; font-size: 0.85rem; color: #4a4f6a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: var(--navy); color: #ffffff; }
  th { padding: 10px; text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e9f5; font-variant-numeric: tabular-nums; }
  .cell-num, th.cell-num { text-align: right; }
  .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-bottom: 16px; font-variant-numeric: tabular-nums; }
  .totals .grand { color: var(--navy); font-size: 1.25rem; font-weight: 700; margin-top: 4px; }
  .exchange-rate-note { color: #4a4f6a; font-size: 0.8rem; }
  .vat-note { background: var(--pale-blue); color: var(--navy); border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.9rem; }
  .notes { margin-bottom: 16px; color: #33364f; font-size: 0.9rem; }
  .footer { border-top: 1px solid rgba(17, 31, 74, 0.2); padding-top: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; color: #8a90a6; font-size: 0.78rem; }
  .footer svg { flex-shrink: 0; }
  @media (max-width: 560px) {
    body { padding: 16px; }
    .page { padding: 16px; }
    .parties { flex-direction: column; }
    .parties-single { max-width: none; }
    table thead { display: none; }
    table, tbody, tr, td { display: block; width: 100%; }
    tr { border: 1px solid #e5e9f5; border-radius: 10px; margin-bottom: 8px; padding: 6px 10px; }
    td { border: none; padding: 4px 0; text-align: right; }
    td.cell-desc { text-align: left; font-weight: 600; }
    td::before { content: attr(data-label); float: left; color: #8a90a6; font-weight: 400; }
    td.cell-desc::before { content: none; }
    .footer { flex-wrap: wrap; }
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    .page { box-shadow: none; border-radius: 0; padding: 0; }
    @page { margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="issuer-identity">
        ${
          company
            ? `<div class="badge">${escapeHtml(companyInitials(company.name))}</div><p class="party-name">${escapeHtml(company.name)}</p>`
            : ""
        }
      </div>
      <div class="doc-meta">
        <p class="doc-title">${escapeHtml(documentTitle)}</p>
        <p class="doc-number">${escapeHtml(documentNumber)}</p>
        ${statusChip ? `<span class="status-chip">${escapeHtml(statusChip)}</span>` : ""}
      </div>
    </div>

    <div class="parties${company ? "" : " parties-single"}">
      ${
        company
          ? `<div class="party-card">
        <h2>${escapeHtml(labels.seller)}</h2>
        ${companyBlockHtml(company, labels)}
      </div>`
          : ""
      }
      <div class="party-card">
        <h2>${escapeHtml(labels.buyer)}</h2>
        <p class="party-name">${escapeHtml(invoice.clientName)}</p>
        ${invoice.clientTaxNumber ? `<p>${escapeHtml(labels.taxNumber)}: ${escapeHtml(invoice.clientTaxNumber)}</p>` : ""}
      </div>
    </div>

    <div class="meta-row">
      <span>${escapeHtml(labels.issueDate)}: ${escapeHtml(formatInvoiceIssueDateTime(invoice))}</span>
      <span>${escapeHtml(labels.dueDate)}: ${escapeHtml(formatInvoiceDueDate(invoice))}</span>
      ${paymentMethodLabel ? `<span>${escapeHtml(labels.paymentMethod)}: ${escapeHtml(paymentMethodLabel)}</span>` : ""}
      <span>${escapeHtml(labels.currency)}: ${escapeHtml(invoice.currency)}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>${escapeHtml(labels.description)}</th>
          <th class="cell-num">${escapeHtml(labels.quantity)}</th>
          <th class="cell-num">${escapeHtml(labels.unitPrice)}</th>
          <th class="cell-num">${escapeHtml(labels.net)}</th>
          <th class="cell-num">${escapeHtml(labels.vat)}</th>
          <th class="cell-num">${escapeHtml(labels.gross)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <span>${escapeHtml(labels.netTotal)}: ${formatDocumentAmount(totals.subtotal, invoice.currency)}</span>
      <span>${escapeHtml(labels.vatTotal)}: ${formatDocumentAmount(totals.vatTotal, invoice.currency)}</span>
      ${exchangeRateHtml}
      <span class="grand">${escapeHtml(labels.grossTotal)}: ${formatDocumentAmount(totals.totalAmount, invoice.currency)}</span>
    </div>

    ${exemptionReasons.length > 0 ? `<div class="vat-note">${exemptionReasons.map(escapeHtml).join("<br>")}</div>` : ""}
    ${invoice.notes ? `<div class="notes"><strong>${escapeHtml(labels.notes)}:</strong> ${escapeHtml(invoice.notes)}</div>` : ""}

    <div class="footer">${brandMarkSvg({ size: 20 })}<span>${escapeHtml(labels.footer)}</span></div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
