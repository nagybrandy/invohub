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
} from "@/lib/invoices/calculations";
import {
  documentLabels,
  documentStatusChip,
  formatDocumentAmount,
  toWinAnsiSafe,
} from "@/lib/invoices/document-labels";
import { requiresExchangeRate, resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import { resolveVatExemptionReason } from "@/lib/invoices/vat";
import {
  formatInvoiceDueDate,
  formatInvoiceIssueDateTime,
} from "@/lib/dates/format";
import { createPdfDocument, withPdfKitFonts } from "@/lib/invoices/pdf-document";
import { registerDocumentFonts, type DocumentFonts } from "@/lib/invoices/pdf-fonts";
import { drawBrandLockup } from "@/lib/invoices/pdf-brand-mark";
import {
  companyInitials,
  contentBottom,
  drawLogoBadge,
  drawLogoImage,
  drawNoteBox,
  drawPartyCard,
  drawTableHeader,
  drawTableRow,
  drawTotalLine,
  ensureSpace,
  footerBandTop,
  loadLogoImage,
  partyCardHeight,
  PDF_PAGE_MARGINS,
  readableTextOn,
  tableColumns,
  tint,
  totalsColumns,
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
    doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor("#666666");
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
    doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor("#666666");
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
  doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor("#666666");
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

export type InvoicePdfContext = {
  invoice: Invoice;
  company?: InvoicePdfCompany;
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

        // -------------------------------------------------------------
        // Header (AC8): logo/badge + company name (left); title, number,
        // status chip (right). The full seller block (tax number, address,
        // bank account) now lives in the Kibocsátó party card below, same
        // as preview-html.ts's `.issuer-identity` (name only next to the
        // badge).
        // -------------------------------------------------------------
        const logoSize = 52;
        const headerTop = doc.y;
        const logoX = left;
        const logoY = headerTop;

        if (logoBuffer) {
          drawLogoImage(doc, logoBuffer, logoX, logoY, logoSize);
        } else {
          const initials = companyInitials(company?.name ?? template.titleText);
          drawLogoBadge(doc, logoX, logoY, logoSize, initials, accent);
        }

        const infoX = logoX + logoSize + 16;
        const metaX = left + pageWidth * 0.55;
        const metaWidth = pageWidth * 0.45;

        let headerBlockBottom = logoY + logoSize;
        if (company?.name) {
          doc.font(docFonts.bold).fontSize(fonts.subtitle).fillColor("#111f4a");
          doc.text(company.name, infoX, logoY, { width: metaX - infoX - 12 });
          const nameHeight = doc.heightOfString(company.name, { width: metaX - infoX - 12 });
          doc.fillColor("#000000");
          headerBlockBottom = Math.max(headerBlockBottom, logoY + nameHeight);
        }

        let metaY = logoY;
        doc.font(docFonts.bold).fontSize(fonts.title).fillColor(accent);
        doc.text(template.titleText, metaX, metaY, { width: metaWidth, align: "right" });
        metaY += fonts.title + 8;
        doc.font(docFonts.bold).fontSize(fonts.subtitle).fillColor("#111111");
        doc.text(invoice.invoiceNumber || labels.draftNumber, metaX, metaY, {
          width: metaWidth,
          align: "right",
        });
        metaY += fonts.subtitle + 8;
        doc.fillColor("#000000");

        // AC15: a pill (rounded tint(accent, 0.24) fill + readable text)
        // for statuses that change what the document IS — see
        // documentStatusChip's own "internal bookkeeping state" rule. A
        // null chip draws nothing and consumes no vertical space.
        const statusChip = documentStatusChip(invoice.status);
        if (statusChip) {
          doc.font(docFonts.bold).fontSize(fonts.small);
          const chipTextWidth = doc.widthOfString(statusChip);
          const chipPaddingX = 8;
          const chipHeight = fonts.small + 8;
          const chipWidth = chipTextWidth + chipPaddingX * 2;
          const chipX = right - chipWidth;
          const chipFill = tint(accent, 0.24);
          doc.roundedRect(chipX, metaY, chipWidth, chipHeight, chipHeight / 2).fill(chipFill);
          doc.fillColor(readableTextOn(chipFill));
          doc.text(statusChip, chipX, metaY + chipHeight / 2 - fonts.small / 2, {
            width: chipWidth,
            align: "center",
          });
          doc.fillColor("#000000");
          metaY += chipHeight;
        }

        headerBlockBottom = Math.max(headerBlockBottom, metaY);

        doc.y = headerBlockBottom + 20;
        doc
          .moveTo(left, doc.y)
          .lineTo(right, doc.y)
          .strokeColor("#e5e7eb")
          .lineWidth(1)
          .stroke();

        doc.y += 16;

        // -------------------------------------------------------------
        // Party cards (AC8/AC9): Kibocsátó + Vevő side by side with a
        // company, Vevő alone (half width) without one — mirrors
        // preview-html.ts's `.parties` / `.parties-single`.
        // -------------------------------------------------------------
        const cardGutter = 16;
        const cardFontSizes = { title: fonts.small, body: fonts.body };

        const buyerLines = [
          invoice.clientName,
          template.showClientTaxNumber && invoice.clientTaxNumber
            ? `${labels.taxNumber}: ${invoice.clientTaxNumber}`
            : "",
        ].filter(Boolean);

        let cardsBottom: number;

        if (template.showCompanyBlock && company) {
          const sellerLines = [
            company.name,
            company.taxNumber ? `${labels.taxNumber}: ${company.taxNumber}` : "",
            [company.address, company.city, company.zipCode, company.country].filter(Boolean).join(", "),
            template.showBankDetails && company.bankAccount ? `${labels.bankAccount}: ${company.bankAccount}` : "",
          ].filter(Boolean);

          const cardWidth = (pageWidth - cardGutter) / 2;
          const sellerHeight = partyCardHeight(doc, {
            width: cardWidth,
            title: labels.seller,
            lines: sellerLines,
            fontSizes: cardFontSizes,
          });
          const buyerHeight = partyCardHeight(doc, {
            width: cardWidth,
            title: labels.buyer,
            lines: buyerLines,
            fontSizes: cardFontSizes,
          });
          const cardHeight = Math.max(sellerHeight, buyerHeight);

          ensureSpace(doc, cardHeight);
          const topY = doc.y;

          drawPartyCard(doc, {
            x: left,
            y: topY,
            width: cardWidth,
            title: labels.seller,
            lines: sellerLines,
            accent,
            fontSizes: cardFontSizes,
            height: cardHeight,
          });
          drawPartyCard(doc, {
            x: left + cardWidth + cardGutter,
            y: topY,
            width: cardWidth,
            title: labels.buyer,
            lines: buyerLines,
            accent,
            fontSizes: cardFontSizes,
            height: cardHeight,
          });

          cardsBottom = topY + cardHeight;
        } else {
          const cardWidth = pageWidth * 0.5;
          const buyerHeight = partyCardHeight(doc, {
            width: cardWidth,
            title: labels.buyer,
            lines: buyerLines,
            fontSizes: cardFontSizes,
          });

          ensureSpace(doc, buyerHeight);
          const topY = doc.y;

          drawPartyCard(doc, {
            x: left,
            y: topY,
            width: cardWidth,
            title: labels.buyer,
            lines: buyerLines,
            accent,
            fontSizes: cardFontSizes,
          });

          cardsBottom = topY + buyerHeight;
        }

        // AC10: a MEASURED advance (cardsBottom + 12..24), not the old
        // fixed offset this replaced — a taller Kibocsátó card (a long
        // address wrapping at `large` fontScale) no longer pushes the meta
        // row under the table header.
        doc.y = cardsBottom + 16;

        // -------------------------------------------------------------
        // Meta row (AC11): issue date, due date, payment method (only
        // when set), currency — a single flowing row, mirrors
        // preview-html.ts's `.meta-row`.
        // -------------------------------------------------------------
        const metaSegments: string[] = [
          `${labels.issueDate}: ${formatInvoiceIssueDateTime(invoice)}`,
          `${labels.dueDate}: ${formatInvoiceDueDate(invoice)}`,
        ];
        if (invoice.paymentMethod) {
          const paymentMethodLabel = labels.paymentMethods[invoice.paymentMethod as PaymentMethod];
          metaSegments.push(`${labels.paymentMethod}: ${paymentMethodLabel}`);
        }
        metaSegments.push(`${labels.currency}: ${invoice.currency}`);

        doc.font(docFonts.regular).fontSize(fonts.body);
        const metaGap = 20;
        const metaLineGap = 4;
        const metaLineHeight = doc.currentLineHeight();

        // Wrap segments to a new line when they would overflow the content
        // width (mirrors preview-html.ts's `.meta-row { flex-wrap: wrap }`)
        // instead of drawing past `right` unconditionally — a long localized
        // fizetési mód label plus the other three segments can exceed the
        // content width at fontScale=medium/large (see the AC11 regression
        // this replaced).
        const metaLines: string[][] = [];
        let metaLineWidth = 0;
        for (const segment of metaSegments) {
          const segmentWidth = doc.widthOfString(segment);
          const currentLine = metaLines[metaLines.length - 1];
          const wouldOverflow =
            currentLine !== undefined &&
            left + metaLineWidth + metaGap + segmentWidth > right;
          if (currentLine === undefined || wouldOverflow) {
            metaLines.push([segment]);
            metaLineWidth = segmentWidth;
          } else {
            currentLine.push(segment);
            metaLineWidth += metaGap + segmentWidth;
          }
        }
        const metaRowHeight =
          metaLines.length * metaLineHeight + (metaLines.length - 1) * metaLineGap;

        ensureSpace(doc, metaRowHeight + 20);
        doc.fillColor("#4a4f6a");
        const metaRowY = doc.y;
        let metaCursorY = metaRowY;
        for (const line of metaLines) {
          let metaCursorX = left;
          for (const segment of line) {
            doc.text(segment, metaCursorX, metaCursorY, { lineBreak: false });
            metaCursorX += doc.widthOfString(segment) + metaGap;
          }
          metaCursorY += metaLineHeight + metaLineGap;
        }
        doc.fillColor("#000000");
        doc.y = metaRowY + metaRowHeight + 16;

        // -------------------------------------------------------------
        // Line-item table (AC3/AC4/AC5/AC12): 6 columns incl. Nettó, a
        // filled accent header band, per-row hairlines.
        // -------------------------------------------------------------
        ensureSpace(doc, 60);

        const cols = tableColumns(doc);
        const headerLabels = [
          labels.description,
          labels.quantity,
          labels.unitPrice,
          labels.net,
          labels.vat,
          labels.gross,
        ];
        doc.y = drawTableHeader(doc, cols, headerLabels, fonts.small, accent);

        const exemptCategories = new Set<string>();

        // Shared by both continuation mechanisms that need it: the
        // line-item loop's explicit page break just below, and the notes
        // block's `pageAdded`-scoped listener further down. One expression
        // so the two continuation banners can never drift apart (plan
        // docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md §5.1).
        const continuationBanner = `${invoice.invoiceNumber || labels.draftNumber} · ${labels.continued}`;

        for (const item of invoice.lineItems) {
          const netTotal = lineItemNetTotal(item);
          const lineTotal = lineItemGrossTotal(item);
          const rowHeightEstimate = doc.heightOfString(item.description, {
            width: cols.descWidth,
          }) + 16;

          if (item.vatCategory !== "normal") {
            exemptCategories.add(item.vatCategory);
          }

          // AC4/AC11 (pagination slice): an explicit break (not
          // ensureSpace, which never repeats a header) so a continuation
          // page always opens with the "<invoiceNumber> · folytatás"
          // caption and the column header repeated — never bare rows. The
          // `doc.y > top + 0.5` guard mirrors ensureSpace's own "already
          // at the top of a fresh page" rule so an oversized first row
          // can't open two pages back to back.
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
            doc.y = drawTableHeader(doc, cols, headerLabels, fonts.small, accent);
          }

          const rowY = doc.y;
          doc.y = drawTableRow(
            doc,
            cols,
            {
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: formatDocumentAmount(item.unitPrice, invoice.currency),
              net: formatDocumentAmount(netTotal, invoice.currency),
              vat: item.vatCategory === "normal" ? `${item.vatRate}%` : item.vatCategory,
              total: formatDocumentAmount(lineTotal, invoice.currency),
            },
            rowY,
            fonts.small
          );
        }

        // -------------------------------------------------------------
        // Totals (AC13): net/VAT (+ optional forint VAT) rows on a
        // tint(accent, 0.12) panel, the grand total on a tint(accent,
        // 0.24) band with readable text — one measured ensureSpace call
        // reserves the whole panel.
        // -------------------------------------------------------------
        const totalsCols = totalsColumns(doc, cols);
        type TotalsRow = { label: string; value: string; fontSize: number };
        const totalsRows: TotalsRow[] = [
          {
            label: `${labels.netTotal}:`,
            value: formatDocumentAmount(totals.subtotal, invoice.currency),
            fontSize: fonts.body,
          },
          {
            label: `${labels.vatTotal}:`,
            value: formatDocumentAmount(totals.vatTotal, invoice.currency),
            fontSize: fonts.body,
          },
        ];

        // AC14/AC15 (branding slice): a non-HUF invoice also shows the VAT
        // amount in forint, right under the document-currency VAT total —
        // same rule as the NAV XML builder (lib/nav/invoice-xml.ts):
        // convert per line, then sum the rounded HUF values.
        if (requiresExchangeRate(invoice.currency)) {
          const rateResolution = resolveExchangeRate(invoice);
          if (rateResolution.ok) {
            const vatTotalHuf = invoice.lineItems.reduce(
              (sum, item) => sum + toHufAmount(lineItemVatAmount(item), rateResolution.rate),
              0
            );
            totalsRows.push({
              label: `${labels.vatInHuf}:`,
              value: formatDocumentAmount(vatTotalHuf, "HUF"),
              fontSize: fonts.body,
            });
          }
        }

        const grandRow: TotalsRow = {
          label: `${labels.grossTotal}:`,
          value: formatDocumentAmount(totals.totalAmount, invoice.currency),
          fontSize: fonts.subtitle,
        };

        const panelPaddingX = 12;
        const panelPaddingY = 10;
        const rowGap = 6;

        function measuredRowHeight(row: TotalsRow): number {
          doc.fontSize(row.fontSize);
          return Math.max(
            doc.heightOfString(row.label, { width: totalsCols.labelWidth }),
            doc.heightOfString(row.value, { width: totalsCols.valueWidth })
          );
        }

        const regularRowsHeight = totalsRows.reduce((sum, row) => sum + measuredRowHeight(row) + rowGap, 0);
        const grandBandHeight = measuredRowHeight(grandRow) + panelPaddingY * 2;
        const panelHeight = panelPaddingY * 2 + regularRowsHeight + grandBandHeight;

        const panelX = totalsCols.labelX - panelPaddingX;
        const panelWidth = right - panelX;

        const measuredTotalsHeight = 8 + panelHeight + 8;
        ensureSpace(doc, measuredTotalsHeight);
        doc.y += 8;

        const panelY = doc.y;
        doc.roundedRect(panelX, panelY, panelWidth, panelHeight, 8).fill(tint(accent, 0.12));

        let rowY = panelY + panelPaddingY;
        for (const row of totalsRows) {
          rowY = drawTotalLine(
            doc,
            row.label,
            row.value,
            totalsCols.labelX,
            totalsCols.valueX,
            rowY,
            totalsCols.labelWidth,
            totalsCols.valueWidth,
            { fontSize: row.fontSize }
          );
        }

        const grandBandY = panelY + panelHeight - grandBandHeight;
        doc.rect(panelX, grandBandY, panelWidth, grandBandHeight).fill(tint(accent, 0.24));
        const grandTextColor = readableTextOn(tint(accent, 0.24));
        drawTotalLine(
          doc,
          grandRow.label,
          grandRow.value,
          totalsCols.labelX,
          totalsCols.valueX,
          grandBandY + panelPaddingY,
          totalsCols.labelWidth,
          totalsCols.valueWidth,
          { bold: true, accent: grandTextColor, fontSize: grandRow.fontSize }
        );

        doc.y = panelY + panelHeight + 8;

        // -------------------------------------------------------------
        // ÁFA exemption note (AC14): inside a tinted, padded note box —
        // mirrors preview-html.ts's `.vat-note`.
        // -------------------------------------------------------------
        if (exemptCategories.size > 0) {
          const reasons = invoice.lineItems
            .filter((item) => exemptCategories.has(item.vatCategory))
            .map((item) => resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason))
            .filter((reason, index, all): reason is string => !!reason && all.indexOf(reason) === index);

          const notePadding = 12;
          const noteInnerWidth = pageWidth - notePadding * 2;
          doc.fontSize(fonts.small);
          const noteLinesHeight = reasons.reduce(
            (sum, reason) => sum + doc.heightOfString(reason, { width: noteInnerWidth }) + 4,
            0
          );
          const noteHeight = Math.max(noteLinesHeight, doc.currentLineHeight()) + notePadding * 2;

          ensureSpace(doc, noteHeight + 8);
          doc.y += 8;
          const noteFill = tint(accent, 0.24);
          const noteBottom = drawNoteBox(doc, {
            x: left,
            y: doc.y,
            width: pageWidth,
            lines: reasons,
            fill: noteFill,
            fontSize: fonts.small,
          });
          doc.y = noteBottom + 8;
        }

        // -------------------------------------------------------------
        // Notes
        // -------------------------------------------------------------
        if (invoice.notes) {
          // Reserve the label line plus the first ~3 lines of the notes
          // body so "Megjegyzés:" is never orphaned at the bottom of a
          // page — pdfkit then flows any remainder correctly on its own
          // because of the margins fix (CONTENT_MARGIN_BOTTOM).
          doc.fontSize(fonts.body);
          const labelHeight = doc.heightOfString(`${template.notesLabel}:`, { width: pageWidth });
          doc.fontSize(fonts.small);
          const notesHeight = doc.heightOfString(invoice.notes, { width: pageWidth });
          const lineHeight = doc.currentLineHeight();
          const reserve = labelHeight + Math.min(notesHeight, 3 * lineHeight) + 16;
          ensureSpace(doc, reserve);
          doc.y += 8;
          doc.font(docFonts.bold).fontSize(fonts.body).fillColor("#444444");
          doc.text(`${template.notesLabel}:`, left, doc.y);
          doc.y += fonts.body + 4;
          doc.font(docFonts.regular).fontSize(fonts.small);

          // Plan docs/plans/2026-09-21-pdf-notes-continuation-page-caption.md:
          // the notes body below can paginate INSIDE the single doc.text()
          // call — pdfkit's own auto-pagination (LineWrapper.nextSection(),
          // triggered by page.margins.bottom === CONTENT_MARGIN_BOTTOM),
          // which nothing else in this file observes. A `pageAdded`
          // listener scoped to just this draw gets a chance to run between
          // pdfkit's addPage() and the wrapper resuming on the new page
          // (addPage() emits 'pageAdded' before nextSection() restores x /
          // fillColor and before the wrapper emits any more lines), so it
          // can draw the same banner the line-item continuation pages get
          // plus a repeated section label, and hand the wrapper back
          // exactly the text state (font/size/fill) it had.
          const notesContinuedLabel = `${labels.sectionContinued.replace("{{section}}", template.notesLabel)}:`;
          // Re-entrancy guard: doc.text() inside the listener could in
          // principle itself trigger another 'pageAdded' — make a nested
          // call a no-op rather than recursing. (In practice this draw
          // starts at the top margin and never needs to paginate on its
          // own, but the guard is one line and removes the whole class of
          // infinite recursion.)
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
              doc.font(docFonts.bold).fontSize(fonts.body).fillColor("#444444");
              doc.text(notesContinuedLabel, left, doc.y, { width: pageWidth });
              doc.y += fonts.body + 4;
              // Hand the wrapper back exactly the state it had before this
              // listener ran (font/size/fill) — the wrapper keeps emitting
              // the remaining lines with whatever is current when this
              // listener returns.
              doc.font(docFonts.regular).fontSize(fonts.small).fillColor("#444444");
            } finally {
              drawingNotesHeading = false;
            }
          };
          doc.on("pageAdded", onNotesPageAdded);
          try {
            doc.text(invoice.notes, left, doc.y, { width: pageWidth, lineGap: 3 });
          } finally {
            // Never let this listener survive the notes draw — doc.text()
            // above can throw (e.g. a font resolution failure), and a
            // leaked listener would draw captions on unrelated future
            // pages (AC6).
            doc.off("pageAdded", onNotesPageAdded);
          }
          // pdfkit already advances doc.y to the end of the drawn
          // (possibly paginated) text — adding heightOfString(...) again
          // here would double-count the advance.
          doc.y += 8;
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
