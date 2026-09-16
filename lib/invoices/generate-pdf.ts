// lib/invoices/generate-pdf.ts
// Server-side invoice PDF generation (pdfkit) with clean, readable layout.
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
  drawLogoBadge,
  drawLogoImage,
  drawTableHeader,
  drawTableRow,
  drawTextBlock,
  drawTotalLine,
  ensureSpace,
  footerBandTop,
  loadLogoImage,
  tableColumns,
} from "@/lib/invoices/pdf-layout";
import {
  DEFAULT_PDF_TEMPLATE,
  mergePdfTemplate,
  pdfFontSizes,
} from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import type { Invoice } from "@/lib/invoices/types";
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
  }
): void {
  const textY = bandTop + 12;
  const markY = bandTop + 9;

  doc.moveTo(opts.left, bandTop).lineTo(opts.right, bandTop).strokeColor("#e5e7eb").lineWidth(1).stroke();

  if (opts.footerText) {
    doc.font(opts.docFonts.regular).fontSize(opts.fontSize).fillColor("#666666");
    doc.text(opts.footerText, opts.left, textY, {
      width: opts.pageWidth * 0.5,
      lineBreak: false,
      ellipsis: true,
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
        const doc = createPdfDocument({ margin: 48, size: "A4", bufferPages: true });
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

        const companyLines: string[] = [labels.seller];
        if (template.showCompanyBlock && company) {
          companyLines.push(company.name);
          if (company.taxNumber) companyLines.push(`${labels.taxNumber}: ${company.taxNumber}`);
          const addressLine = [company.address, company.city, company.zipCode, company.country]
            .filter(Boolean)
            .join(", ");
          if (addressLine) companyLines.push(addressLine);
          if (template.showBankDetails && company.bankAccount) {
            companyLines.push(`${labels.bankAccount}: ${company.bankAccount}`);
          }
        } else if (company?.name) {
          companyLines.push(company.name);
        }

        const infoBottom = drawTextBlock(doc, companyLines, infoX, logoY, metaX - infoX - 12, fonts.body);
        const headerBlockBottom = Math.max(logoY + logoSize, infoBottom);

        let metaY = logoY;
        doc.font(docFonts.bold).fontSize(fonts.title).fillColor(accent);
        doc.text(template.titleText, metaX, metaY, { width: metaWidth, align: "right" });
        metaY += fonts.title + 8;
        doc.font(docFonts.bold).fontSize(fonts.subtitle).fillColor("#111111");
        doc.text(invoice.invoiceNumber || labels.draftNumber, metaX, metaY, {
          width: metaWidth,
          align: "right",
        });
        metaY += fonts.subtitle + 6;
        doc.font(docFonts.regular).fontSize(fonts.body).fillColor("#666666");
        // The document stops printing internal bookkeeping state (plan
        // §1(b)) — only statuses that change what the document IS get a
        // line at all ("sent"/"unpaid"/"overdue"/"partially_paid" print
        // nothing here, same rule as the HTML preview).
        const statusChip = documentStatusChip(invoice.status);
        if (statusChip) {
          doc.text(statusChip, metaX, metaY, { width: metaWidth, align: "right" });
          metaY += fonts.body + 4;
        }
        doc.text(`${labels.issueDate}: ${formatInvoiceIssueDateTime(invoice)}`, metaX, metaY, {
          width: metaWidth,
          align: "right",
        });
        metaY += fonts.body + 3;
        doc.text(`${labels.dueDate}: ${formatInvoiceDueDate(invoice)}`, metaX, metaY, {
          width: metaWidth,
          align: "right",
        });
        doc.fillColor("#000000");

        doc.y = Math.max(headerBlockBottom, metaY) + 20;
        doc
          .moveTo(left, doc.y)
          .lineTo(right, doc.y)
          .strokeColor("#e5e7eb")
          .lineWidth(1)
          .stroke();

        doc.y += 16;
        ensureSpace(doc, 80);

        const billToY = doc.y;
        drawTextBlock(
          doc,
          [
            labels.buyer,
            invoice.clientName,
            template.showClientTaxNumber && invoice.clientTaxNumber
              ? `${labels.taxNumber}: ${invoice.clientTaxNumber}`
              : "",
          ].filter(Boolean),
          left,
          billToY,
          pageWidth * 0.5,
          fonts.body,
          { bold: false, lineGap: 4 }
        );
        drawTextBlock(
          doc,
          [`${labels.currency}: ${invoice.currency}`],
          metaX,
          billToY,
          metaWidth,
          fonts.body,
          { lineGap: 4 }
        );

        doc.y = billToY + 56;
        ensureSpace(doc, 60);

        const cols = tableColumns(doc);
        doc.y = drawTableHeader(
          doc,
          cols,
          [labels.description, labels.quantity, labels.unitPrice, labels.vat, labels.gross],
          fonts.small,
          accent
        );

        const exemptCategories = new Set<string>();

        for (const item of invoice.lineItems) {
          const lineTotal = lineItemGrossTotal(item);
          const rowHeightEstimate = doc.heightOfString(item.description, {
            width: cols.descWidth,
          }) + 16;

          if (item.vatCategory !== "normal") {
            exemptCategories.add(item.vatCategory);
          }

          ensureSpace(doc, rowHeightEstimate + 8);
          const rowY = doc.y;
          doc.y = drawTableRow(
            doc,
            cols,
            {
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: formatDocumentAmount(item.unitPrice, invoice.currency),
              vat: item.vatCategory === "normal" ? `${item.vatRate}%` : item.vatCategory,
              total: formatDocumentAmount(lineTotal, invoice.currency),
            },
            rowY,
            fonts.small
          );
        }

        ensureSpace(doc, 90);
        doc.y += 8;
        const totalsLineY = doc.y;
        doc
          .moveTo(left + pageWidth * 0.52, totalsLineY)
          .lineTo(right, totalsLineY)
          .strokeColor("#e5e7eb")
          .stroke();

        let totalsY = totalsLineY + 12;
        const labelX = cols.totalX - 84;
        const valueX = cols.totalX;

        totalsY = drawTotalLine(
          doc,
          `${labels.netTotal}:`,
          formatDocumentAmount(totals.subtotal, invoice.currency),
          labelX,
          valueX,
          totalsY,
          { fontSize: fonts.body }
        );
        totalsY = drawTotalLine(
          doc,
          `${labels.vatTotal}:`,
          formatDocumentAmount(totals.vatTotal, invoice.currency),
          labelX,
          valueX,
          totalsY,
          { fontSize: fonts.body }
        );
        totalsY = drawTotalLine(
          doc,
          `${labels.grossTotal}:`,
          formatDocumentAmount(totals.totalAmount, invoice.currency),
          labelX,
          valueX,
          totalsY,
          { bold: true, accent, fontSize: fonts.subtitle }
        );

        // AC14/AC15: a non-HUF invoice also shows the VAT amount in forint,
        // right under the document-currency VAT/total block — same rule as
        // the NAV XML builder (lib/nav/invoice-xml.ts): convert per line,
        // then sum the rounded HUF values. See plan OQ-3 for wording status.
        if (requiresExchangeRate(invoice.currency)) {
          const rateResolution = resolveExchangeRate(invoice);
          if (rateResolution.ok) {
            const vatTotalHuf = invoice.lineItems.reduce(
              (sum, item) => sum + toHufAmount(lineItemVatAmount(item), rateResolution.rate),
              0
            );
            totalsY = drawTotalLine(
              doc,
              `${labels.vatInHuf}:`,
              formatDocumentAmount(vatTotalHuf, "HUF"),
              labelX,
              valueX,
              totalsY,
              { fontSize: fonts.body }
            );
          }
        }
        doc.y = totalsY + 8;

        if (exemptCategories.size > 0) {
          const reasons = invoice.lineItems
            .filter((item) => exemptCategories.has(item.vatCategory))
            .map((item) => resolveVatExemptionReason(item.vatCategory, item.vatExemptionReason))
            .filter((reason, index, all): reason is string => !!reason && all.indexOf(reason) === index);

          ensureSpace(doc, 20 + reasons.length * 14);
          doc.font(docFonts.bold).fontSize(fonts.small).fillColor("#444444");
          for (const reason of reasons) {
            doc.text(reason, left, doc.y, { width: pageWidth });
            doc.y += fonts.small + 4;
          }
          doc.fillColor("#000000");
          doc.y += 4;
        }

        if (invoice.notes) {
          ensureSpace(doc, 48);
          doc.y += 8;
          doc.font(docFonts.bold).fontSize(fonts.body).fillColor("#444444");
          doc.text(`${template.notesLabel}:`, left, doc.y);
          doc.y += fonts.body + 4;
          doc.font(docFonts.regular).fontSize(fonts.small);
          doc.text(invoice.notes, left, doc.y, { width: pageWidth, lineGap: 3 });
          doc.y += doc.heightOfString(invoice.notes, { width: pageWidth }) + 8;
        }

        // AC7: the footer strip is drawn on every buffered page, not just
        // whichever page happened to be current when generation ended.
        // Per-page margins.bottom is zeroed only around the draw itself
        // (pdfkit's own buffered-pages idiom) — footerBandTop(doc) is read
        // beforehand, against the real margins, so the band position is
        // unaffected.
        const footerRange = doc.bufferedPageRange();
        for (let i = footerRange.start; i < footerRange.start + footerRange.count; i += 1) {
          doc.switchToPage(i);
          const bandTop = footerBandTop(doc);
          const savedMarginBottom = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          drawFooterOnCurrentPage(doc, bandTop, {
            docFonts,
            footerText: template.footerText,
            labels,
            fontSize: fonts.small,
            left,
            right,
            pageWidth,
          });
          doc.page.margins.bottom = savedMarginBottom;
        }
        doc.flushPages();

        doc.end();
      })
  );
}
