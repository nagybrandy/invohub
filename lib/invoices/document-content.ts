// lib/invoices/document-content.ts
// WHAT the invoice document prints, as pure data (no pdfkit): every string,
// derived with exactly the rules and functions the legacy renderer
// (lib/invoices/pdf-legacy.ts) uses — documentTitleFor / documentStatusChip,
// formatDocumentAmount / formatDocumentQuantity, vatSummaryByRate, the
// non-HUF "ÁFA összege forintban" rule, resolveVatExemptionReason, the
// Teljesítés kelte / Fizetési mód / Árfolyam cells. No VAT, rounding or
// numbering logic lives here; the paper renderer
// (lib/invoices/paper/render-paper.ts) only lays this content out. The
// legacy renderer is frozen and does not consume this module; the
// mandatory-content matrix test keeps the two printing the same strings.
import {
  calculateInvoiceTotals,
  lineItemGrossTotal,
  lineItemNetTotal,
  lineItemVatAmount,
  vatSummaryByRate,
} from "@/lib/invoices/calculations";
import {
  DOCUMENT_INTL_LOCALE,
  documentLabels,
  documentStatusChip,
  documentTitleFor,
  formatDocumentAmount,
  formatDocumentQuantity,
  formatPartyAddress,
  toDocumentLocale,
  type DocumentLabels,
  type DocumentLocale,
} from "@/lib/invoices/document-labels";
import { requiresExchangeRate, resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import type { InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { localizePdfTemplate } from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import { hasInvoiceNumber, type PaymentMethod } from "@/lib/invoices/types";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import { formatDateOnly, formatInvoiceDueDate } from "@/lib/dates/format";

export type LabelledValue = { label: string; value: string };

export type DocumentContentRow = {
  description: string;
  /** Per-line remark, printed small under the description. */
  note?: string;
  quantity: string;
  unitPrice: string;
  net: string;
  vat: string;
  total: string;
};

export type DocumentContent = {
  locale: DocumentLocale;
  labels: DocumentLabels;
  /** The (localized) template the content was derived with. */
  template: InvoicePdfTemplate;
  title: string;
  /** invoice.invoiceNumber, or the draft label for an unnumbered draft. */
  number: string;
  /** True for an unnumbered draft (watermark + "Piszkozat" number). */
  isUnnumberedDraft: boolean;
  statusChip: string | null;
  /** "Az X sorszámú számla helyesbítése/sztornója", when a reference is known. */
  referenceText: string | null;
  /** The issuer identity printed in the header; never hidden by a toggle. null without a company name. */
  issuer: { name: string; address: string; taxNumber: string } | null;
  metaCells: LabelledValue[];
  /** Kibocsátó box; null when hidden by showCompanyBlock or without a company. */
  seller: { title: string; name: string; lines: string[] } | null;
  buyer: { title: string; name: string; lines: string[] };
  columnLabels: [string, string, string, string, string, string];
  rows: DocumentContentRow[];
  vatSummary: { caption: string; header: [string, string, string, string]; rows: string[][] };
  totalsRows: LabelledValue[];
  due: { label: string; value: string; isRefund: boolean };
  /** Payment strip cells; null when no strip is printed. */
  payment: { caption: string; cells: LabelledValue[] } | null;
  exemptionReasons: string[];
  notes: string;
  notesLabel: string;
  /** "<number> · folytatás" banner of every continuation page. */
  continuationBanner: string;
  /** "<notesLabel> (folytatás)" caption of a notes continuation page. */
  notesContinuedLabel: string;
  footerText: string;
  /** The right-hand attribution text of the footer (no mark). */
  footerAttribution: string;
  pageIndicator: (page: number, total: number) => string;
};

export type DocumentContentOptions = {
  /**
   * The buyer's tax number is printed whenever the invoice carries one,
   * whatever showClientTaxNumber says (Áfa tv. 169. § d; the NAV report
   * carries it). The paper layouts pass true; the toggle then has no effect.
   */
  alwaysPrintBuyerTaxNumber?: boolean;
};

export function buildDocumentContent(
  ctx: InvoicePdfContext & { template: InvoicePdfTemplate },
  options: DocumentContentOptions = {}
): DocumentContent {
  const { invoice, company, buyer } = ctx;
  const locale = toDocumentLocale(invoice.language);
  const intlLocale = DOCUMENT_INTL_LOCALE[locale];
  const labels = documentLabels(locale);
  const template = localizePdfTemplate(ctx.template, locale);
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const rateResolution = requiresExchangeRate(invoice.currency) ? resolveExchangeRate(invoice) : null;
  const money = (amount: number) => formatDocumentAmount(amount, invoice.currency, locale);

  const numbered = hasInvoiceNumber(invoice);
  const isUnnumberedDraft = invoice.status === "draft" && !numbered;
  const number = invoice.invoiceNumber || labels.draftNumber;

  // A díjbekérő / sztornó / helyesbítő prints its own document type — only a
  // plain számla uses the user's configurable title text.
  const title =
    invoice.documentType === "invoice"
      ? template.titleText
      : documentTitleFor(invoice.documentType, locale).toUpperCase();

  // Áfa tv. 170. § — a storno / helyesbítő must name the invoice it modifies.
  const referenceTemplate =
    invoice.documentType === "modify"
      ? labels.referenceModify
      : invoice.documentType === "storno"
        ? labels.referenceStorno
        : null;
  const referenceText =
    referenceTemplate && ctx.referencedInvoiceNumber
      ? referenceTemplate.replace("{{number}}", ctx.referencedInvoiceNumber)
      : null;

  const issuer = company?.name
    ? {
        name: company.name,
        address: formatPartyAddress(company),
        taxNumber: company.taxNumber ? `${labels.taxNumber}: ${company.taxNumber}` : "",
      }
    : null;

  // Meta strip: issue date, Teljesítés kelte (only when resolved: the issue
  // date is never printed under that label), due date, payment method (when
  // set), currency, and the exchange rate on a non-HUF document.
  const metaCells: LabelledValue[] = [
    { label: labels.issueDate, value: formatDateOnly(invoice.issueDate, intlLocale) },
  ];
  if (invoice.fulfillmentDate) {
    metaCells.push({ label: labels.fulfillmentDate, value: formatDateOnly(invoice.fulfillmentDate, intlLocale) });
  }
  metaCells.push({ label: labels.dueDate, value: formatInvoiceDueDate(invoice, intlLocale) });
  if (invoice.paymentMethod) {
    metaCells.push({
      label: labels.paymentMethod,
      value: labels.paymentMethods[invoice.paymentMethod as PaymentMethod],
    });
  }
  metaCells.push({ label: labels.currency, value: invoice.currency });
  if (rateResolution?.ok) {
    metaCells.push({
      label: labels.exchangeRate,
      value: labels.exchangeRateValue
        .replace("{{currency}}", invoice.currency)
        .replace(
          "{{rate}}",
          new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 4, useGrouping: true }).format(rateResolution.rate)
        ),
    });
  }

  // Parties. The buyer's address comes from the linked partner / snapshot
  // (ctx.buyer): Áfa tv. 169. § e) requires it.
  const showBuyerTax =
    !!invoice.clientTaxNumber && (options.alwaysPrintBuyerTaxNumber === true || template.showClientTaxNumber);
  const buyerLines = [
    formatPartyAddress(buyer ?? {}),
    showBuyerTax ? `${labels.taxNumber}: ${invoice.clientTaxNumber}` : "",
    buyer?.euVatNumber ? `${labels.euVatNumber}: ${buyer.euVatNumber}` : "",
  ].filter(Boolean);
  const seller =
    template.showCompanyBlock && company
      ? {
          title: labels.seller,
          name: company.name,
          lines: [
            formatPartyAddress(company),
            company.taxNumber ? `${labels.taxNumber}: ${company.taxNumber}` : "",
            template.showBankDetails && company.bankAccount ? `${labels.bankAccount}: ${company.bankAccount}` : "",
          ].filter(Boolean),
        }
      : null;

  const rows: DocumentContentRow[] = invoice.lineItems.map((item) => ({
    description: item.description,
    note: item.comment?.trim() || undefined,
    quantity: formatDocumentQuantity(item.quantity, item.unit, locale),
    unitPrice: money(item.unitPrice),
    net: money(lineItemNetTotal(item)),
    vat: item.vatCategory === "normal" ? `${item.vatRate}%` : item.vatCategory,
    total: money(lineItemGrossTotal(item)),
  }));

  const totalsRows: LabelledValue[] = [
    { label: labels.netTotal, value: money(totals.subtotal) },
    { label: labels.vatTotal, value: money(totals.vatTotal) },
  ];
  // A non-HUF invoice also shows the VAT amount in forint — same rule as the
  // NAV XML builder: convert per line, then sum the rounded HUF values.
  if (rateResolution?.ok) {
    const vatTotalHuf = invoice.lineItems.reduce(
      (sum, item) => sum + toHufAmount(lineItemVatAmount(item), rateResolution.rate),
      0
    );
    totalsRows.push({ label: labels.vatInHuf, value: formatDocumentAmount(vatTotalHuf, "HUF", locale) });
  }
  // A net-negative correction/storno is money owed TO the buyer.
  const isRefund = totals.totalAmount < 0;
  const due = {
    label: isRefund ? labels.refundTotal : labels.grossTotal,
    value: money(totals.totalAmount),
    isRefund,
  };

  const vatSummary = {
    caption: labels.vatSummary,
    header: [labels.vatRateColumn, labels.net, labels.vatAmount, labels.gross] as [string, string, string, string],
    rows: vatSummaryByRate(invoice.lineItems).map((row) => [
      row.label,
      money(row.net),
      money(row.vat),
      money(row.gross),
    ]),
  };

  // Payment strip: a transfer (or an unset method) that is not a refund.
  // With a bank account and showBankDetails: account, Közlemény (when
  // numbered) and due date; otherwise just the due date (Dóri's single-cell
  // strip).
  const transferLike = invoice.paymentMethod === undefined || invoice.paymentMethod === "transfer";
  let payment: DocumentContent["payment"] = null;
  if (!isRefund && transferLike) {
    const dueCell = { label: labels.dueDate, value: formatInvoiceDueDate(invoice, intlLocale) };
    payment = {
      caption: labels.paymentDetails,
      cells:
        template.showBankDetails && company?.bankAccount
          ? [
              { label: labels.bankAccount, value: company.bankAccount },
              ...(numbered ? [{ label: labels.paymentReference, value: invoice.invoiceNumber }] : []),
              dueCell,
            ]
          : [dueCell],
    };
  }

  const exemptCategories = new Set(
    invoice.lineItems.filter((item) => item.vatCategory !== "normal").map((item) => item.vatCategory)
  );
  const exemptionReasons = invoice.lineItems
    .filter((item) => exemptCategories.has(item.vatCategory))
    .map((item) => resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason))
    .filter((reason, index, all): reason is string => !!reason && all.indexOf(reason) === index);

  return {
    locale,
    labels,
    template,
    title,
    number,
    isUnnumberedDraft,
    // Dóri's header carries a grey "KIÁLLÍTVA" tag on an issued document. It is
    // definitional (not app state like sent/unpaid) and only shown when no
    // stronger status (Piszkozat / Kifizetve / Törölve) takes the tag's place.
    statusChip: documentStatusChip(invoice.status, locale) ?? (numbered ? labels.issued : null),
    referenceText,
    issuer,
    metaCells,
    seller,
    buyer: { title: labels.buyer, name: invoice.clientName, lines: buyerLines },
    columnLabels: [labels.description, labels.quantity, labels.unitPrice, labels.net, labels.vat, labels.gross],
    rows,
    vatSummary,
    totalsRows,
    due,
    payment,
    exemptionReasons,
    notes: invoice.notes ?? "",
    notesLabel: template.notesLabel,
    continuationBanner: `${number} · ${labels.continued}`,
    notesContinuedLabel: labels.sectionContinued.replace("{{section}}", template.notesLabel),
    footerText: template.footerText,
    footerAttribution: labels.footer,
    pageIndicator: (page, total) =>
      labels.pageIndicator.replace("{{page}}", String(page)).replace("{{total}}", String(total)),
  };
}
