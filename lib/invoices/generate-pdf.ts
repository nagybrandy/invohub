// lib/invoices/generate-pdf.ts
// Server-side invoice PDF generation (pdfkit) with clean, readable layout.
import {
  calculateInvoiceTotals,
  formatCurrency,
} from "@/lib/invoices/calculations";
import { createPdfDocument, withPdfKitFonts } from "@/lib/invoices/pdf-document";
import {
  companyInitials,
  contentBottom,
  drawLogoBadge,
  drawLogoImage,
  drawTableHeader,
  drawTableRow,
  drawTextBlock,
  drawTotalLine,
  ensureSpace,
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
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_");
  return `${safe}.pdf`;
}

export async function generateInvoicePdf(ctx: InvoicePdfContext): Promise<Buffer> {
  const { invoice, company } = ctx;
  const template = mergePdfTemplate(ctx.template ?? DEFAULT_PDF_TEMPLATE);
  const fonts = pdfFontSizes(template.fontScale);
  const totals = calculateInvoiceTotals(invoice.lineItems);
  const logoBuffer = company?.logoUrl ? await loadLogoImage(company.logoUrl) : null;

  return withPdfKitFonts(
    () =>
      new Promise((resolve, reject) => {
        const doc = createPdfDocument({ margin: 48, size: "A4", bufferPages: true });
        const chunks: Buffer[] = [];
        const accent = template.accentColor;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const left = doc.page.margins.left;
        const right = left + pageWidth;

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

        const companyLines: string[] = [];
        if (template.showCompanyBlock && company) {
          companyLines.push(company.name);
          if (company.taxNumber) companyLines.push(`Tax no.: ${company.taxNumber}`);
          const addressLine = [company.address, company.city, company.zipCode, company.country]
            .filter(Boolean)
            .join(", ");
          if (addressLine) companyLines.push(addressLine);
          if (template.showBankDetails && company.bankAccount) {
            companyLines.push(`Bank: ${company.bankAccount}`);
          }
        } else if (company?.name) {
          companyLines.push(company.name);
        }

        const infoBottom = drawTextBlock(doc, companyLines, infoX, logoY, metaX - infoX - 12, fonts.body);
        const headerBlockBottom = Math.max(logoY + logoSize, infoBottom);

        let metaY = logoY;
        doc.font("Helvetica-Bold").fontSize(fonts.title).fillColor(accent);
        doc.text(template.titleText, metaX, metaY, { width: metaWidth, align: "right" });
        metaY += fonts.title + 8;
        doc.font("Helvetica-Bold").fontSize(fonts.subtitle).fillColor("#111111");
        doc.text(invoice.invoiceNumber, metaX, metaY, { width: metaWidth, align: "right" });
        metaY += fonts.subtitle + 6;
        doc.font("Helvetica").fontSize(fonts.body).fillColor("#666666");
        doc.text(`Status: ${invoice.status}`, metaX, metaY, { width: metaWidth, align: "right" });
        metaY += fonts.body + 4;
        doc.text(`Issue: ${invoice.issueDate}`, metaX, metaY, { width: metaWidth, align: "right" });
        metaY += fonts.body + 3;
        doc.text(`Due: ${invoice.dueDate}`, metaX, metaY, { width: metaWidth, align: "right" });
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
            "Bill to",
            invoice.clientName,
            template.showClientTaxNumber && invoice.clientTaxNumber
              ? `Tax no.: ${invoice.clientTaxNumber}`
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
          ["Invoice details", `Currency: ${invoice.currency}`],
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
          ["Description", "Qty", "Unit", "VAT", "Total"],
          fonts.small,
          accent
        );

        for (const item of invoice.lineItems) {
          const lineTotal =
            item.quantity * item.unitPrice * (1 + item.vatRate / 100);
          const rowHeightEstimate = doc.heightOfString(item.description, {
            width: cols.descWidth,
          }) + 16;

          ensureSpace(doc, rowHeightEstimate + 8);
          const rowY = doc.y;
          doc.y = drawTableRow(
            doc,
            cols,
            {
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: formatCurrency(item.unitPrice, invoice.currency),
              vat: `${item.vatRate}%`,
              total: formatCurrency(lineTotal, invoice.currency),
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
          "Subtotal:",
          formatCurrency(totals.subtotal, invoice.currency),
          labelX,
          valueX,
          totalsY,
          { fontSize: fonts.body }
        );
        totalsY = drawTotalLine(
          doc,
          "VAT:",
          formatCurrency(totals.vatTotal, invoice.currency),
          labelX,
          valueX,
          totalsY,
          { fontSize: fonts.body }
        );
        totalsY = drawTotalLine(
          doc,
          "Total:",
          formatCurrency(totals.totalAmount, invoice.currency),
          labelX,
          valueX,
          totalsY,
          { bold: true, accent, fontSize: fonts.subtitle }
        );
        doc.y = totalsY + 8;

        if (invoice.notes) {
          ensureSpace(doc, 48);
          doc.y += 8;
          doc.font("Helvetica-Bold").fontSize(fonts.body).fillColor("#444444");
          doc.text(`${template.notesLabel}:`, left, doc.y);
          doc.y += fonts.body + 4;
          doc.font("Helvetica").fontSize(fonts.small);
          doc.text(invoice.notes, left, doc.y, { width: pageWidth, lineGap: 3 });
          doc.y += doc.heightOfString(invoice.notes, { width: pageWidth }) + 8;
        }

        if (template.footerText) {
          const footerY = contentBottom(doc, 0) + 8;
          doc.font("Helvetica").fontSize(fonts.small).fillColor("#888888");
          doc.text(template.footerText, left, footerY, {
            width: pageWidth,
            align: "center",
          });
        }

        doc.end();
      })
  );
}
