// lib/invoices/generate-pdf.ts
// Server-side invoice PDF generation (pdfkit) with clean, readable layout
// that mirrors the HTML preview's section order and framing (see
// docs/plans/2026-09-16-pdf-layout-general-improvement.md).
// Hungarian labels + Hungarian money formatting (see
// docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md).
// Fonts: registerDocumentFonts (lib/invoices/pdf-fonts.ts) embeds a real
// Latin-Extended-A TTF so ő/ű draw correctly (see
// docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md). The
// toWinAnsiSafe `doc.text` patch below only runs on the fallback path, when
// the embedded fonts can't be resolved — see the "if (!docFonts.embedded)"
// block.
import {
  calculateInvoiceTotals,
  lineItemGrossTotal,
  lineItemNetTotal,
  lineItemVatAmount,
  vatSummaryByRate,
} from "@/lib/invoices/calculations";
import {
  documentLabels,
  documentStatusChip,
  documentTitleFor,
  formatDocumentAmount,
  formatDocumentQuantity,
  formatPartyAddress,
  toWinAnsiSafe,
} from "@/lib/invoices/document-labels";
import {
  requiresExchangeRate,
  resolveExchangeRate,
  toHufAmount,
} from "@/lib/invoices/exchange-rate";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import { formatDateOnly, formatInvoiceDueDate } from "@/lib/dates/format";
import { createPdfDocument, withPdfKitFonts } from "@/lib/invoices/pdf-document";
import { registerDocumentFonts, type DocumentFonts } from "@/lib/invoices/pdf-fonts";
import { drawBrandLockup } from "@/lib/invoices/pdf-brand-mark";
import { documentInk, documentSurfaces } from "@/lib/invoices/document-ink";
import {
  companyInitials,
  contentBottom,
  DOCUMENT_HAIRLINE,
  documentLabelSize,
  drawLogoBadge,
  drawLogoImage,
  drawPartyBlock,
  drawTableHeader,
  drawTableRow,
  ensureSpace,
  footerBandTop,
  loadLogoImage,
  partyBlockHeight,
  PDF_PAGE_MARGINS,
  readableTextOn,
  tableColumns,
  tint,
} from "@/lib/invoices/pdf-layout";
import {
  DEFAULT_PDF_TEMPLATE,
  mergePdfTemplate,
  pdfFontSizes,
} from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import type { Invoice, PaymentMethod } from "@/lib/invoices/types";
import type PDFDocument from "pdfkit";
import type { DocumentLabels } from "@/lib/invoices/document-labels";

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Draws the branding footer strip on the CURRENT page (caller must
 * doc.switchToPage(i) first) — a hairline rule, the issuer's own
 * template.footerText (left), and the InvoHub mark + attribution lockup
 * (right, or centred when there is no issuer footer text). Lives in the
 * reserved band bandTop..(page.height - margins.bottom) (AC9), so it can
 * never collide with document content.
 *
 * `bandTop` is passed in (rather than read here via footerBandTop(doc))
 * because the caller reads it BEFORE zeroing doc.page.margins.bottom for
 * the duration of this draw (pdfkit's own buffered-pages idiom) —
 * footerBandTop's own calculation depends on that margin.
 */
function drawFooterOnCurrentPage(
  doc: Doc,
  bandTop: number,
  opts: {
    docFonts: DocumentFonts;
    footerText: string;
    labels: DocumentLabels;
    fontSize: number;
    left: number;
    right: number;
    pageWidth: number;
    // AC12: "{{page}}/{{total}}. oldal" (already interpolated), or null on
    // a single-page document — the existing empty-footerText centred
    // lockup stays exactly as before when there is nothing else to show.
    pageIndicatorText: string | null;
  }
): void {
  const textY = bandTop + 12;
  const markY = bandTop + 9;

  doc.moveTo(opts.left, bandTop).lineTo(opts.right, bandTop).strokeColor("#e5e7eb").lineWidth(1).stroke();

  if (opts.footerText) {
    // Narrowed from 0.5 to 0.42 of the page width to leave room for the
    // page indicator between the issuer's own footer text and the lockup
    // (AC12/AC13) without the two ever colliding.
    doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor(documentInk.muted);
    doc.text(opts.footerText, opts.left, textY, {
      width: opts.pageWidth * 0.42,
      lineBreak: false,
      ellipsis: true,
    });
    if (opts.pageIndicatorText) {
      doc.text(opts.pageIndicatorText, opts.left + opts.pageWidth * 0.42, textY, {
        width: opts.pageWidth * 0.16,
        align: "center",
        lineBreak: false,
      });
    }
    doc.fillColor("#000000");

    drawBrandLockup(doc, {
      x: opts.right,
      y: markY,
      text: opts.labels.footer,
      font: opts.docFonts.regular,
      fontSize: opts.fontSize,
      align: "right",
    });
  } else if (opts.pageIndicatorText) {
    doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor(documentInk.muted);
    doc.text(opts.pageIndicatorText, opts.left, textY, {
      width: opts.pageWidth * 0.3,
      lineBreak: false,
    });
    doc.fillColor("#000000");

    drawBrandLockup(doc, {
      x: opts.right,
      y: markY,
      text: opts.labels.footer,
      font: opts.docFonts.regular,
      fontSize: opts.fontSize,
      align: "right",
    });
  } else {
    drawBrandLockup(doc, {
      x: opts.left + opts.pageWidth / 2,
      y: markY,
      text: opts.labels.footer,
      font: opts.docFonts.regular,
      fontSize: opts.fontSize,
      align: "center",
    });
  }
}

/**
 * Draws "<invoiceNumber> · folytatás" at the top of a continuation page
 * (AC11) and advances doc.y past it by the measured height, so a
 * multi-page invoice is identifiable once its pages are printed and
 * separated (plan §1(d)).
 */
function drawContinuationCaption(
  doc: Doc,
  opts: { docFonts: DocumentFonts; text: string; fontSize: number; left: number; width: number }
): void {
  doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor(documentInk.muted);
  doc.text(opts.text, opts.left, doc.y, { width: opts.width });
  doc.y += doc.heightOfString(opts.text, { width: opts.width }) + 8;
  doc.fillColor("#000000");
}

export type InvoicePdfCompany = {
  name: string;
  taxNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  bankAccount?: string;
  logoUrl?: string;
};

/** Buyer details that live on the linked partner, not on the invoice row. */
export type InvoicePdfBuyer = {
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  euVatNumber?: string;
};

export type InvoicePdfContext = {
  invoice: Invoice;
  company?: InvoicePdfCompany;
  buyer?: InvoicePdfBuyer;
  template?: InvoicePdfTemplate;
};

export function invoicePdfFilename(invoiceNumber: string): string {
  const safe = (invoiceNumber || "DRAFT").replace(/[^\w.-]+/g, "_");
  return `${safe}.pdf`;
}

export async function generateInvoicePdf(ctx: InvoicePdfContext): Promise<Buffer> {
  const { invoice, company } = ctx;
  const template = mergePdfTemplate(ctx.template ?? DEFAULT_PDF_TEMPLATE);
  const fonts = pdfFontSizes(template.fontScale);
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const logoBuffer = company?.logoUrl ? await loadLogoImage(company.logoUrl) : null;
  const labels = documentLabels();

  return withPdfKitFonts(
    () =>
      new Promise((resolve, reject) => {
        const doc = createPdfDocument({ margins: PDF_PAGE_MARGINS, size: "A4", bufferPages: true });
        const chunks: Buffer[] = [];
        const accent = template.accentColor;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const left = doc.page.margins.left;
        const right = left + pageWidth;

        // Embed a real Latin-Extended-A font so ő/ű draw correctly (see
        // lib/invoices/pdf-fonts.ts). `docFonts.regular`/`docFonts.bold`
        // are the names every doc.font(...) call below must use — never a
        // hard-coded "Helvetica"/"Helvetica-Bold" (AC7; see pdf-fonts.ts's
        // header comment for why that silently breaks embedding).
        const docFonts = registerDocumentFonts(doc);

        // Fallback only: when the embedded font files can't be resolved,
        // route every drawn string through toWinAnsiSafe exactly once, here
        // — pdfkit's standard Helvetica AFM writes WinAnsi (cp1252), which
        // has no glyph for ő/ű (see document-labels.ts). Loudly log the
        // degradation once; the PDF still renders, never throws.
        if (!docFonts.embedded) {
          console.error(
            "generateInvoicePdf: embedded PDF fonts unresolvable, falling back to ő→ö / ű→ü transliteration"
          );
          const rawText = doc.text.bind(doc) as (...args: unknown[]) => typeof doc;
          doc.text = ((value: string, ...rest: unknown[]) =>
            rawText(toWinAnsiSafe(value), ...rest)) as typeof doc.text;
        }

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // =============================================================
        // Layout (2026-09-22 redesign). A calm, paper-first document:
        // typographic hierarchy + hairlines instead of filled panels, one
        // accent used sparingly (the page-top bar, party ticks, the logo
        // badge), and the single dark band reserved for the amount due.
        // Section order: header -> meta strip -> parties -> line items ->
        // [VAT summary + payment details | totals] -> exemption note ->
        // notes. Every block is measured and reserved with ensureSpace; the
        // line-item loop and the notes body keep their continuation-page
        // behaviour (caption + repeated header / repeated notes label).
        // =============================================================
        const ink = documentInk;
        // One banner for every continuation mechanism — line-item page
        // breaks, block reservations (summary / note / notes) and the notes
        // body's own auto-pagination — so a printed, separated page can
        // always be matched to its invoice.
        const continuationBanner = `${invoice.invoiceNumber || labels.draftNumber} · ${labels.continued}`;
        const reserve = (neededHeight: number) => {
          const pageBefore = doc.page;
          ensureSpace(doc, neededHeight);
          if (doc.page !== pageBefore) {
            drawContinuationCaption(doc, {
              docFonts,
              text: continuationBanner,
              fontSize: fonts.small,
              left,
              width: pageWidth,
            });
          }
        };
        const labelSize = documentLabelSize(fonts.small);
        const hairline = (y: number, x1 = left, x2 = right) => {
          doc.moveTo(x1, y).lineTo(x2, y).strokeColor(DOCUMENT_HAIRLINE).lineWidth(0.6).stroke();
          doc.strokeColor("#000000").lineWidth(1);
        };
        const CAPTION_SPACING = 0.6;
        const captionHeight = (text: string, width: number) => {
          doc.font(docFonts.bold).fontSize(labelSize);
          return doc.heightOfString(text.toUpperCase(), { width, characterSpacing: CAPTION_SPACING });
        };
        const caption = (text: string, x: number, y: number, width: number) => {
          const height = captionHeight(text, width);
          doc.fillColor(ink.muted);
          doc.text(text.toUpperCase(), x, y, { width, characterSpacing: CAPTION_SPACING });
          return y + height;
        };

        // -------------------------------------------------------------
        // Header: issuer identity (left), document title + number (right).
        // A díjbekérő / sztornó / helyesbítő prints its own document type —
        // only a plain számla uses the user's configurable title text, so a
        // proforma can never go out titled "SZÁMLA".
        // -------------------------------------------------------------
        const headerTop = doc.y + 6;
        const logoSize = 40;
        const identityMaxX = left + pageWidth * 0.58;
        let identityBottom = headerTop;

        if (company?.name) {
          let identityX = left;
          if (logoBuffer) {
            drawLogoImage(doc, logoBuffer, left, headerTop, logoSize);
            identityX = left + logoSize + 12;
            identityBottom = headerTop + logoSize;
          } else {
            drawLogoBadge(doc, left, headerTop, logoSize, companyInitials(company.name), accent);
            identityX = left + logoSize + 12;
            identityBottom = headerTop + logoSize;
          }
          const identityWidth = identityMaxX - identityX;
          doc.font(docFonts.bold).fontSize(fonts.subtitle + 2).fillColor(ink.heading);
          doc.text(company.name, identityX, headerTop + 2, { width: identityWidth });
          let identityY = headerTop + 2 + doc.heightOfString(company.name, { width: identityWidth });
          const identitySub = [company.city, company.taxNumber ? `${labels.taxNumber}: ${company.taxNumber}` : ""]
            .filter(Boolean)
            .join("  ·  ");
          if (identitySub) {
            doc.font(docFonts.regular).fontSize(fonts.small).fillColor(ink.secondary);
            doc.text(identitySub, identityX, identityY + 2, { width: identityWidth });
            identityY += 2 + doc.heightOfString(identitySub, { width: identityWidth });
          }
          identityBottom = Math.max(identityBottom, identityY);
        }

        const documentTitle =
          invoice.documentType === "invoice"
            ? template.titleText
            : documentTitleFor(invoice.documentType).toUpperCase();
        const titleWidth = pageWidth * 0.4;
        const titleX = right - titleWidth;
        doc.font(docFonts.bold).fontSize(fonts.title + 4).fillColor(ink.heading);
        doc.text(documentTitle, titleX, headerTop - 4, { width: titleWidth, align: "right", characterSpacing: 1.2 });
        let titleY = headerTop - 4 + doc.heightOfString(documentTitle, { width: titleWidth });
        const documentNumber = invoice.invoiceNumber || labels.draftNumber;
        doc.font(docFonts.bold).fontSize(fonts.subtitle).fillColor(ink.secondary);
        doc.text(documentNumber, titleX, titleY + 2, { width: titleWidth, align: "right" });
        titleY += 2 + doc.heightOfString(documentNumber, { width: titleWidth });

        // Status pill only for statuses that change what the document IS
        // (documentStatusChip's own rule); a null chip draws nothing.
        const statusChip = documentStatusChip(invoice.status);
        if (statusChip) {
          doc.font(docFonts.bold).fontSize(labelSize);
          const chipLabel = statusChip.toUpperCase();
          const chipWidth = doc.widthOfString(chipLabel) + 16;
          const chipHeight = labelSize + 9;
          const chipX = right - chipWidth;
          const chipY = titleY + 6;
          const chipFill = tint(accent, 0.82);
          doc.roundedRect(chipX, chipY, chipWidth, chipHeight, chipHeight / 2).fill(chipFill);
          doc.fillColor(readableTextOn(chipFill));
          doc.text(chipLabel, chipX, chipY + (chipHeight - labelSize) / 2 - 0.5, {
            width: chipWidth,
            align: "center",
            characterSpacing: 0.6,
          });
          titleY = chipY + chipHeight;
        }
        doc.fillColor("#000000");

        doc.y = Math.max(identityBottom, titleY) + 22;

        // -------------------------------------------------------------
        // Meta strip: equal-width cells between two hairlines — issue
        // date (date only; an invoice states a day, not a clock time), due
        // date, payment method (when set), currency, and the exchange rate
        // on a non-HUF document.
        // -------------------------------------------------------------
        const metaCells: Array<{ label: string; value: string }> = [
          { label: labels.issueDate, value: formatDateOnly(invoice.issueDate) },
        ];
        // Teljesítés kelte (AC6): only when a fulfillment date is actually
        // resolved — the issue date is never printed under this label.
        if (invoice.fulfillmentDate) {
          metaCells.push({ label: labels.fulfillmentDate, value: formatDateOnly(invoice.fulfillmentDate) });
        }
        metaCells.push({ label: labels.dueDate, value: formatInvoiceDueDate(invoice) });
        if (invoice.paymentMethod) {
          metaCells.push({
            label: labels.paymentMethod,
            value: labels.paymentMethods[invoice.paymentMethod as PaymentMethod],
          });
        }
        metaCells.push({ label: labels.currency, value: invoice.currency });
        const rateResolution = requiresExchangeRate(invoice.currency) ? resolveExchangeRate(invoice) : null;
        if (rateResolution?.ok) {
          metaCells.push({
            label: labels.exchangeRate,
            value: labels.exchangeRateValue
              .replace("{{currency}}", invoice.currency)
              .replace(
                "{{rate}}",
                new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 4, useGrouping: true }).format(
                  rateResolution.rate
                )
              ),
          });
        }

        const metaCellWidth = pageWidth / metaCells.length;
        const metaPadX = 10;
        const metaPadY = 9;
        const metaInnerWidth = (index: number) => metaCellWidth - metaPadX - (index === 0 ? 0 : metaPadX);
        const metaLabelHeight = Math.max(
          ...metaCells.map((cell, index) => captionHeight(cell.label, metaInnerWidth(index)))
        );
        doc.font(docFonts.bold).fontSize(fonts.body + 0.5);
        const metaValueHeight = Math.max(
          ...metaCells.map((cell, index) => doc.heightOfString(cell.value, { width: metaInnerWidth(index) }))
        );
        const metaHeight = metaPadY * 2 + metaLabelHeight + 4 + metaValueHeight;

        reserve(metaHeight + 24);
        const metaTop = doc.y;
        hairline(metaTop);
        metaCells.forEach((cell, index) => {
          const cellX = left + index * metaCellWidth;
          const innerX = index === 0 ? cellX : cellX + metaPadX;
          const innerWidth = metaInnerWidth(index);
          if (index > 0) {
            doc
              .moveTo(cellX, metaTop + 7)
              .lineTo(cellX, metaTop + metaHeight - 7)
              .strokeColor(DOCUMENT_HAIRLINE)
              .lineWidth(0.6)
              .stroke();
          }
          caption(cell.label, innerX, metaTop + metaPadY, innerWidth);
          doc.font(docFonts.bold).fontSize(fonts.body + 0.5).fillColor(ink.heading);
          doc.text(cell.value, innerX, metaTop + metaPadY + metaLabelHeight + 4, { width: innerWidth });
        });
        doc.strokeColor("#000000").lineWidth(1).fillColor("#000000");
        hairline(metaTop + metaHeight);
        doc.y = metaTop + metaHeight + 22;

        // -------------------------------------------------------------
        // Parties: Kibocsátó | Vevő. The buyer's address comes from the
        // linked partner (ctx.buyer) — the invoice row itself only stores
        // name + tax number, and Áfa tv. 169. § e) requires the address.
        // -------------------------------------------------------------
        const partyGutter = 28;
        const partyWidth = (pageWidth - partyGutter) / 2;
        const partyFontSizes = { label: labelSize, name: fonts.body + 1.5, body: fonts.body };
        const buyer = ctx.buyer;
        const buyerLines = [
          formatPartyAddress(buyer ?? {}),
          template.showClientTaxNumber && invoice.clientTaxNumber
            ? `${labels.taxNumber}: ${invoice.clientTaxNumber}`
            : "",
          buyer?.euVatNumber ? `${labels.euVatNumber}: ${buyer.euVatNumber}` : "",
        ].filter(Boolean);
        const buyerBlock = { width: partyWidth, title: labels.buyer, name: invoice.clientName, lines: buyerLines, fontSizes: partyFontSizes };

        const showSeller = template.showCompanyBlock && !!company;
        const sellerBlock = company
          ? {
              width: partyWidth,
              title: labels.seller,
              name: company.name,
              lines: [
                formatPartyAddress(company),
                company.taxNumber ? `${labels.taxNumber}: ${company.taxNumber}` : "",
                template.showBankDetails && company.bankAccount ? `${labels.bankAccount}: ${company.bankAccount}` : "",
              ].filter(Boolean),
              fontSizes: partyFontSizes,
            }
          : null;

        const partiesHeight = Math.max(
          partyBlockHeight(doc, buyerBlock),
          showSeller && sellerBlock ? partyBlockHeight(doc, sellerBlock) : 0
        );
        reserve(partiesHeight + 24);
        const partiesTop = doc.y;
        if (showSeller && sellerBlock) {
          drawPartyBlock(doc, { ...sellerBlock, x: left, y: partiesTop, accent });
          drawPartyBlock(doc, { ...buyerBlock, x: left + partyWidth + partyGutter, y: partiesTop, accent });
        } else {
          drawPartyBlock(doc, { ...buyerBlock, x: left, y: partiesTop, accent });
        }
        doc.y = partiesTop + partiesHeight + 26;

        // -------------------------------------------------------------
        // Line items: uppercase column labels over one strong rule, quiet
        // hairlines between rows, quantity with its unit.
        // -------------------------------------------------------------
        reserve(60);

        const cols = tableColumns(doc);
        const headerLabels = [
          labels.description,
          labels.quantity,
          labels.unitPrice,
          labels.net,
          labels.vat,
          labels.gross,
        ];
        doc.y = drawTableHeader(doc, cols, headerLabels, fonts.small);

        const exemptCategories = new Set<string>();

        for (const item of invoice.lineItems) {
          const netTotal = lineItemNetTotal(item);
          const lineTotal = lineItemGrossTotal(item);
          const rowHeightEstimate = doc.heightOfString(item.description, {
            width: cols.descWidth,
          }) + 16;

          if (item.vatCategory !== "normal") {
            exemptCategories.add(item.vatCategory);
          }

          // An explicit break (not ensureSpace, which never repeats a
          // header) so a continuation page always opens with the
          // "<invoiceNumber> · folytatás" caption and the column header
          // repeated — never bare rows. The `doc.y > top + 0.5` guard
          // mirrors ensureSpace's "already at the top of a fresh page" rule
          // so an oversized first row can't open two pages back to back.
          const needed = rowHeightEstimate + 8;
          if (doc.y > doc.page.margins.top + 0.5 && doc.y + needed > contentBottom(doc)) {
            doc.addPage();
            drawContinuationCaption(doc, {
              docFonts,
              text: continuationBanner,
              fontSize: fonts.small,
              left,
              width: pageWidth,
            });
            doc.y = drawTableHeader(doc, cols, headerLabels, fonts.small);
          }

          const rowY = doc.y;
          doc.y = drawTableRow(
            doc,
            cols,
            {
              description: item.description,
              quantity: formatDocumentQuantity(item.quantity, item.unit),
              unitPrice: formatDocumentAmount(item.unitPrice, invoice.currency),
              net: formatDocumentAmount(netTotal, invoice.currency),
              vat: item.vatCategory === "normal" ? `${item.vatRate}%` : item.vatCategory,
              total: formatDocumentAmount(lineTotal, invoice.currency),
            },
            rowY,
            fonts.body
          );
        }

        // -------------------------------------------------------------
        // Summary area — two columns sharing one reservation:
        //   left:  ÁFA-összesítő (tax base + tax per rate, Áfa tv. 169. §
        //          j)–k)) and, for a transfer, the payment details the payer
        //          actually needs (account number + közlemény);
        //   right: net / VAT (/ VAT in HUF) and the amount-due band.
        // -------------------------------------------------------------
        const summaryGap = 28;
        const totalsWidth = pageWidth * 0.42;
        const totalsX = right - totalsWidth;
        const leftColWidth = pageWidth - totalsWidth - summaryGap;

        // --- right column: totals ---
        type TotalsRow = { label: string; value: string };
        const totalsRows: TotalsRow[] = [
          { label: labels.netTotal, value: formatDocumentAmount(totals.subtotal, invoice.currency) },
          { label: labels.vatTotal, value: formatDocumentAmount(totals.vatTotal, invoice.currency) },
        ];
        // A non-HUF invoice also shows the VAT amount in forint — same rule
        // as the NAV XML builder (lib/nav/invoice-xml.ts): convert per
        // line, then sum the rounded HUF values.
        if (rateResolution?.ok) {
          const vatTotalHuf = invoice.lineItems.reduce(
            (sum, item) => sum + toHufAmount(lineItemVatAmount(item), rateResolution.rate),
            0
          );
          totalsRows.push({ label: labels.vatInHuf, value: formatDocumentAmount(vatTotalHuf, "HUF") });
        }
        const totalsRowGap = 6;
        doc.font(docFonts.regular).fontSize(fonts.body);
        const totalsValueWidth = totalsWidth * 0.46;
        const totalsLabelWidth = totalsWidth - totalsValueWidth - 8;
        const totalsRowsHeight = totalsRows.reduce(
          (sum, row) =>
            sum +
            Math.max(
              doc.heightOfString(row.label, { width: totalsLabelWidth }),
              doc.heightOfString(row.value, { width: totalsValueWidth })
            ) +
            totalsRowGap,
          0
        );
        const dueLabel = labels.grossTotal;
        const dueValue = formatDocumentAmount(totals.totalAmount, invoice.currency);
        const duePadX = 14;
        const duePadY = 11;
        const dueValueSize = fonts.subtitle + 4;
        doc.font(docFonts.bold).fontSize(labelSize);
        const dueLabelHeight = doc.heightOfString(dueLabel.toUpperCase(), { width: totalsWidth - duePadX * 2 });
        doc.font(docFonts.bold).fontSize(dueValueSize);
        const dueValueHeight = doc.heightOfString(dueValue, { width: totalsWidth - duePadX * 2 });
        const dueBandHeight = duePadY * 2 + dueLabelHeight + 3 + dueValueHeight;
        const totalsHeight = totalsRowsHeight + 6 + dueBandHeight;

        // --- left column: VAT summary ---
        const vatRows = vatSummaryByRate(invoice.lineItems);
        const vatColRate = leftColWidth * 0.22;
        const vatColAmount = (leftColWidth - vatColRate) / 3;
        doc.font(docFonts.regular).fontSize(fonts.small);
        const vatRowHeight = doc.currentLineHeight() + 6;
        const vatCaptionHeight = captionHeight(labels.vatSummary, leftColWidth);
        const vatSummaryHeight = vatCaptionHeight + 8 + vatRowHeight * (vatRows.length + 1) + 4;

        // --- left column: payment details (transfer with a bank account) ---
        const showPaymentBox =
          template.showBankDetails &&
          !!company?.bankAccount &&
          (invoice.paymentMethod === undefined || invoice.paymentMethod === "transfer");
        const paymentLines: Array<{ label: string; value: string }> = showPaymentBox
          ? [
              { label: labels.bankAccount, value: company!.bankAccount! },
              ...(invoice.invoiceNumber ? [{ label: labels.paymentReference, value: invoice.invoiceNumber }] : []),
              { label: labels.dueDate, value: formatInvoiceDueDate(invoice) },
            ]
          : [];
        const paymentPad = 12;
        doc.font(docFonts.regular).fontSize(fonts.small);
        const paymentLineHeight = doc.currentLineHeight() + 4;
        const paymentBoxHeight = showPaymentBox
          ? paymentPad * 2 + captionHeight(labels.paymentDetails, leftColWidth - paymentPad * 2) + 6 +
            paymentLines.length * paymentLineHeight - 4
          : 0;

        const leftHeight = vatSummaryHeight + (showPaymentBox ? 16 + paymentBoxHeight : 0);
        const summaryHeight = Math.max(leftHeight, totalsHeight);

        reserve(summaryHeight + 20);
        doc.y += 10;
        const summaryTop = doc.y;

        // VAT summary table
        let vatY = caption(labels.vatSummary, left, summaryTop, leftColWidth) + 8;
        const vatCells = (values: string[], y: number, opts: { header?: boolean; color: string }) => {
          const spacing = opts.header ? CAPTION_SPACING : 0;
          doc.font(opts.header ? docFonts.bold : docFonts.regular)
            .fontSize(opts.header ? labelSize : fonts.small)
            .fillColor(opts.color);
          const cell = (value: string) => (opts.header ? value.toUpperCase() : value);
          doc.text(cell(values[0]!), left, y, { width: vatColRate, characterSpacing: spacing });
          values.slice(1).forEach((value, i) => {
            doc.text(cell(value), left + vatColRate + i * vatColAmount, y, {
              width: vatColAmount,
              align: "right",
              characterSpacing: spacing,
            });
          });
        };
        vatCells(
          [labels.vatRateColumn, labels.net, labels.vatAmount, labels.gross],
          vatY,
          { header: true, color: ink.muted }
        );
        vatY += vatRowHeight;
        hairline(vatY - 3, left, left + leftColWidth);
        for (const row of vatRows) {
          vatCells(
            [
              row.label,
              formatDocumentAmount(row.net, invoice.currency),
              formatDocumentAmount(row.vat, invoice.currency),
              formatDocumentAmount(row.gross, invoice.currency),
            ],
            vatY,
            { color: ink.secondary }
          );
          vatY += vatRowHeight;
        }

        // Payment details box
        if (showPaymentBox) {
          const boxY = summaryTop + vatSummaryHeight + 16;
          doc.roundedRect(left, boxY, leftColWidth, paymentBoxHeight, 6).fill(documentSurfaces.mist);
          let payY = caption(labels.paymentDetails, left + paymentPad, boxY + paymentPad, leftColWidth - paymentPad * 2) + 6;
          const payLabelWidth = (leftColWidth - paymentPad * 2) * 0.38;
          const payValueWidth = leftColWidth - paymentPad * 2 - payLabelWidth;
          for (const line of paymentLines) {
            doc.font(docFonts.regular).fontSize(fonts.small).fillColor(ink.secondary);
            doc.text(line.label, left + paymentPad, payY, { width: payLabelWidth });
            doc.font(docFonts.bold).fontSize(fonts.small).fillColor(ink.heading);
            doc.text(line.value, left + paymentPad + payLabelWidth, payY, { width: payValueWidth });
            payY += paymentLineHeight;
          }
        }

        // Totals rows
        let totalsY = summaryTop;
        for (const row of totalsRows) {
          doc.font(docFonts.regular).fontSize(fonts.body).fillColor(ink.secondary);
          doc.text(row.label, totalsX, totalsY, { width: totalsLabelWidth });
          doc.fillColor(ink.body);
          doc.text(row.value, right - totalsValueWidth, totalsY, { width: totalsValueWidth, align: "right" });
          totalsY +=
            Math.max(
              doc.heightOfString(row.label, { width: totalsLabelWidth }),
              doc.heightOfString(row.value, { width: totalsValueWidth })
            ) + totalsRowGap;
        }

        // Amount-due band — the one dark block on the page, always navy
        // with white text regardless of the user's accent colour, so it is
        // legible on any template and in greyscale print.
        const dueY = totalsY + 6;
        doc.roundedRect(totalsX, dueY, totalsWidth, dueBandHeight, 6).fill(documentInk.heading);
        doc.font(docFonts.bold).fontSize(labelSize).fillColor("#c9d3ea");
        doc.text(dueLabel.toUpperCase(), totalsX + duePadX, dueY + duePadY, {
          width: totalsWidth - duePadX * 2,
          characterSpacing: 0.6,
        });
        doc.font(docFonts.bold).fontSize(dueValueSize).fillColor("#ffffff");
        doc.text(dueValue, totalsX + duePadX, dueY + duePadY + dueLabelHeight + 3, {
          width: totalsWidth - duePadX * 2,
          align: "right",
        });
        doc.fillColor("#000000");

        doc.y = summaryTop + summaryHeight + 18;

        // -------------------------------------------------------------
        // ÁFA exemption / reverse-charge statement — a quiet panel with an
        // accent bar, one line per distinct reason.
        // -------------------------------------------------------------
        if (exemptCategories.size > 0) {
          const reasons = invoice.lineItems
            .filter((item) => exemptCategories.has(item.vatCategory))
            .map((item) => resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason))
            .filter((reason, index, all): reason is string => !!reason && all.indexOf(reason) === index);

          const notePadX = 14;
          const notePadY = 10;
          const noteInnerWidth = pageWidth - notePadX * 2 - 3;
          doc.font(docFonts.regular).fontSize(fonts.small);
          const noteLinesHeight = reasons.reduce(
            (sum, reason) => sum + doc.heightOfString(reason, { width: noteInnerWidth }) + 3,
            0
          );
          const noteHeight = Math.max(noteLinesHeight, doc.currentLineHeight()) + notePadY * 2;

          reserve(noteHeight + 8);
          const noteY = doc.y;
          doc.rect(left, noteY, pageWidth, noteHeight).fill(documentSurfaces.mist);
          doc.rect(left, noteY, 3, noteHeight).fill(accent);
          let reasonY = noteY + notePadY;
          doc.font(docFonts.regular).fontSize(fonts.small).fillColor(ink.body);
          for (const reason of reasons) {
            doc.text(reason, left + 3 + notePadX, reasonY, { width: noteInnerWidth });
            reasonY += doc.heightOfString(reason, { width: noteInnerWidth }) + 3;
          }
          doc.fillColor("#000000");
          doc.y = noteY + noteHeight + 16;
        }

        // -------------------------------------------------------------
        // Notes
        // -------------------------------------------------------------
        if (invoice.notes) {
          // Reserve the label line plus the first ~3 lines of the notes
          // body so the label is never orphaned at the bottom of a page —
          // pdfkit then flows any remainder correctly on its own because of
          // the margins fix (CONTENT_MARGIN_BOTTOM).
          doc.font(docFonts.bold).fontSize(fonts.body);
          const labelHeight = doc.heightOfString(`${template.notesLabel}:`, { width: pageWidth });
          doc.font(docFonts.regular).fontSize(fonts.small);
          const notesHeight = doc.heightOfString(invoice.notes, { width: pageWidth });
          const lineHeight = doc.currentLineHeight();
          reserve(labelHeight + Math.min(notesHeight, 3 * lineHeight) + 16);
          const notesLabelY = doc.y;
          doc.font(docFonts.bold).fontSize(fonts.body).fillColor(ink.heading);
          doc.text(`${template.notesLabel}:`, left, notesLabelY);
          doc.y = notesLabelY + labelHeight + 3;
          doc.font(docFonts.regular).fontSize(fonts.small).fillColor(ink.secondary);

          // Plan docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md:
          // the notes body below can paginate INSIDE the single doc.text()
          // call — pdfkit's own auto-pagination, which nothing else in this
          // file observes. A `pageAdded` listener scoped to just this draw
          // runs between pdfkit's addPage() and the wrapper resuming on the
          // new page, so it can draw the same banner the line-item
          // continuation pages get plus a repeated section label, and hand
          // the wrapper back exactly the text state (font/size/fill) it had.
          const notesContinuedLabel = `${labels.sectionContinued.replace("{{section}}", template.notesLabel)}:`;
          // Re-entrancy guard: a nested 'pageAdded' becomes a no-op.
          let drawingNotesHeading = false;
          const onNotesPageAdded = () => {
            if (drawingNotesHeading) return;
            drawingNotesHeading = true;
            try {
              drawContinuationCaption(doc, {
                docFonts,
                text: continuationBanner,
                fontSize: fonts.small,
                left,
                width: pageWidth,
              });
              doc.font(docFonts.bold).fontSize(fonts.body).fillColor(ink.heading);
              doc.text(notesContinuedLabel, left, doc.y, { width: pageWidth });
              doc.y += fonts.body + 4;
              doc.font(docFonts.regular).fontSize(fonts.small).fillColor(ink.secondary);
            } finally {
              drawingNotesHeading = false;
            }
          };
          doc.on("pageAdded", onNotesPageAdded);
          try {
            doc.text(invoice.notes, left, doc.y, { width: pageWidth, lineGap: 3 });
          } finally {
            // Never let this listener survive the notes draw (AC6).
            doc.off("pageAdded", onNotesPageAdded);
          }
          // pdfkit already advances doc.y to the end of the drawn
          // (possibly paginated) text.
          doc.y += 8;
          doc.fillColor("#000000");
        }

        // AC7 (pagination slice): the footer strip is drawn on every
        // buffered page, not just whichever page happened to be current
        // when generation ended. Per-page margins.bottom is zeroed only
        // around the draw itself (pdfkit's own buffered-pages idiom) —
        // footerBandTop(doc) is read beforehand, against the real margins,
        // so the band position is unaffected.
        const footerRange = doc.bufferedPageRange();
        for (let i = footerRange.start; i < footerRange.start + footerRange.count; i += 1) {
          doc.switchToPage(i);
          // A thin accent bar across the top edge of every page — the
          // document's single, quiet brand signal (outside the margins, so
          // it can never collide with content).
          doc.rect(0, 0, doc.page.width, 4).fill(accent);
          const bandTop = footerBandTop(doc);
          const savedMarginBottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          // AC12 (pagination slice): only a multi-page document gets a
          // page indicator — a single page keeps the existing
          // empty-footerText behaviour (lockup centred) unchanged.
          const pageIndicatorText =
            footerRange.count > 1
              ? labels.pageIndicator
                  .replace("{{page}}", String(i - footerRange.start + 1))
                  .replace("{{total}}", String(footerRange.count))
              : null;
          drawFooterOnCurrentPage(doc, bandTop, {
            docFonts,
            footerText: template.footerText,
            labels,
            fontSize: fonts.small,
            left,
            right,
            pageWidth,
            pageIndicatorText,
          });
          doc.page.margins.bottom = savedMarginBottom;
        }
        doc.flushPages();

        doc.end();
      })
  );
}
