// lib/invoices/pdf-fonts.test.ts
/** @jest-environment node */
import fs from "node:fs";
import PDFDocument from "pdfkit";
import {
  FALLBACK_FONT_BOLD,
  FALLBACK_FONT_REGULAR,
  PDF_FONT_BOLD,
  PDF_FONT_REGULAR,
  documentFontNames,
  registerDocumentFonts,
  resolvePdfFontFiles,
} from "@/lib/invoices/pdf-fonts";
import { tableColumns } from "@/lib/invoices/pdf-layout";
import { pdfFontSizes } from "@/lib/invoices/pdf-template/defaults";
import type { PdfFontScale } from "@/lib/invoices/pdf-template/types";

const BASE14_RE = /^(Helvetica|Courier|Times|Symbol|ZapfDingbats)/;

describe("resolvePdfFontFiles", () => {
  it("returns both TTF paths and both files exist (AC1/AC2)", () => {
    const files = resolvePdfFontFiles();
    expect(files).not.toBeNull();
    expect(fs.existsSync(files!.regular)).toBe(true);
    expect(fs.existsSync(files!.bold)).toBe(true);
    expect(files!.regular).toMatch(/NotoSans-Regular\.ttf$/);
    expect(files!.bold).toMatch(/NotoSans-Bold\.ttf$/);
  });
});

describe("registerDocumentFonts", () => {
  it("registers both TTFs and returns embedded:true with non-base-14 names (AC2/AC3)", () => {
    const doc = new PDFDocument({ bufferPages: true });
    const result = registerDocumentFonts(doc);

    expect(result.embedded).toBe(true);
    expect(result.regular).toBe(PDF_FONT_REGULAR);
    expect(result.bold).toBe(PDF_FONT_BOLD);
    expect(result.regular).not.toMatch(BASE14_RE);
    expect(result.bold).not.toMatch(BASE14_RE);
  });

  // Locks in the plan's §1 finding: registering under a base-14 name (e.g.
  // "Helvetica") silently falls back to pdfkit's built-in WinAnsi font
  // instead of the embedded TTF — do not "simplify" registerDocumentFonts
  // back to reusing the Helvetica name.
  it("doc.font(regular)/doc.font(bold) resolve to an EmbeddedFont, not a StandardFont (AC3)", () => {
    const doc = new PDFDocument({ bufferPages: true });
    const { regular, bold } = registerDocumentFonts(doc);

    doc.font(regular);
    expect((doc as unknown as { _font: { constructor: { name: string } } })._font.constructor.name).toBe(
      "EmbeddedFont"
    );

    doc.font(bold);
    expect((doc as unknown as { _font: { constructor: { name: string } } })._font.constructor.name).toBe(
      "EmbeddedFont"
    );
  });

  it("can draw Hungarian text once embedded", () => {
    const doc = new PDFDocument({ bufferPages: true });
    const { regular } = registerDocumentFonts(doc);
    doc.font(regular).fontSize(10);
    expect(doc.widthOfString("Tetőfelújítás")).toBeGreaterThan(0);
  });

  it("the five line-item header labels fit their column widths at every fontScale (AC9)", () => {
    const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
    const { bold } = registerDocumentFonts(doc);
    const cols = tableColumns(doc);
    const headerLabels: Array<{ label: string; width: number }> = [
      { label: "Megnevezés", width: cols.descWidth },
      { label: "Mennyiség", width: cols.qtyWidth },
      { label: "Egységár", width: cols.unitWidth },
      { label: "ÁFA", width: cols.vatWidth },
      { label: "Bruttó", width: cols.totalWidth },
    ];

    for (const scale of ["small", "medium", "large"] as PdfFontScale[]) {
      const fonts = pdfFontSizes(scale);
      doc.font(bold).fontSize(fonts.small);
      for (const { label, width } of headerLabels) {
        expect(doc.widthOfString(label)).toBeLessThanOrEqual(width);
      }
    }
  });

  it("falls back to Helvetica when the font files cannot be resolved", () => {
    const existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    try {
      const doc = new PDFDocument({ bufferPages: true });
      const result = registerDocumentFonts(doc);
      expect(result).toEqual({
        embedded: false,
        regular: FALLBACK_FONT_REGULAR,
        bold: FALLBACK_FONT_BOLD,
      });
    } finally {
      existsSyncSpy.mockRestore();
    }
  });
});

describe("documentFontNames", () => {
  it("returns the embedded names once registered on that document", () => {
    const doc = new PDFDocument({ bufferPages: true });
    registerDocumentFonts(doc);
    expect(documentFontNames(doc)).toEqual({ regular: PDF_FONT_REGULAR, bold: PDF_FONT_BOLD });
  });

  it("returns the fallback names on a document with nothing registered", () => {
    const doc = new PDFDocument({ bufferPages: true });
    expect(documentFontNames(doc)).toEqual({
      regular: FALLBACK_FONT_REGULAR,
      bold: FALLBACK_FONT_BOLD,
    });
  });
});
