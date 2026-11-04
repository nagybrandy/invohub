// lib/invoices/pdf-fonts.test.ts
/** @jest-environment node */
import crypto from "node:crypto";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import {
  ALL_PAPER_FONT_FILES,
  FALLBACK_FONT_BOLD,
  FALLBACK_FONT_REGULAR,
  PAPER_FONT_ROLES,
  PDF_FONT_BOLD,
  PDF_FONT_REGULAR,
  documentFontNames,
  registerDocumentFonts,
  registerPaperFonts,
  resolvePaperFontFiles,
  resolvePdfFontFiles,
} from "@/lib/invoices/pdf-fonts";
import { tableColumns } from "@/lib/invoices/pdf-layout";
import { pdfFontSizes } from "@/lib/invoices/pdf-template/defaults";
import type { PdfFontScale, PdfFontStyle } from "@/lib/invoices/pdf-template/types";

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

// ---------------------------------------------------------------------------
// Paper fonts (2026-11 redesign)
// ---------------------------------------------------------------------------
const STYLES: PdfFontStyle[] = ["invohub", "classic", "round"];
const FONT_ROOT = `${process.cwd()}/assets/fonts/pdf`;

describe("paper font registry", () => {
  it("lists 15 distinct files (3 styles x 5 roles)", () => {
    expect(ALL_PAPER_FONT_FILES).toHaveLength(15);
    expect(new Set(ALL_PAPER_FONT_FILES).size).toBe(15);
  });

  it.each(STYLES)("%s: resolves all five files and each exists", (style) => {
    const files = resolvePaperFontFiles(style);
    expect(files).not.toBeNull();
    for (const role of PAPER_FONT_ROLES) expect(fs.existsSync(files![role])).toBe(true);
  });

  it.each(STYLES)("%s: registers non-base-14 names that resolve to an EmbeddedFont", (style) => {
    const doc = new PDFDocument({ bufferPages: true });
    const fonts = registerPaperFonts(doc, style);
    expect(fonts.embedded).toBe(true);
    expect(fonts.source).toBe("style");
    for (const role of PAPER_FONT_ROLES) {
      expect(fonts[role]).not.toMatch(BASE14_RE);
      doc.font(fonts[role]);
      expect((doc as unknown as { _font: { constructor: { name: string } } })._font.constructor.name).toBe(
        "EmbeddedFont"
      );
    }
  });

  it.each(STYLES)("%s: every file has the full Hungarian alphabet and the euro sign", (style) => {
    const doc = new PDFDocument({ bufferPages: true });
    const fonts = registerPaperFonts(doc, style);
    for (const role of PAPER_FONT_ROLES) {
      doc.font(fonts[role]);
      const embedded = (doc as unknown as { _font: { font: { hasGlyphForCodePoint(cp: number): boolean } } })._font.font;
      for (const ch of "áéíóöőúüűÁÉÍÓÖŐÚÜŰ€") {
        expect([role, ch, embedded.hasGlyphForCodePoint(ch.codePointAt(0)!)]).toEqual([role, ch, true]);
      }
    }
  });

  it("vendored files are not modified: sha256 prefixes match the recorded provenance", () => {
    const expected: Record<string, string> = {
      "stack-sans/StackSansNotch-Medium.ttf": "f0210d49d47f0509",
      "stack-sans/StackSansNotch-SemiBold.ttf": "a5bc47d8695bc06b",
      "stack-sans/StackSansNotch-Bold.ttf": "e8e209fbc910e943",
      "stack-sans/StackSansText-Regular.ttf": "41d0548f8da45fc2",
      "stack-sans/StackSansText-Bold.ttf": "4ca8faed9488ce0c",
      "source/SourceSerif4-Medium.ttf": "52307f3b40a41395",
      "source/SourceSerif4-SemiBold.ttf": "f8ca116c25700ca7",
      "source/SourceSerif4-Bold.ttf": "d135bf6f4d3846b0",
      "source/SourceSans3-Regular.ttf": "7ca2b9c4677ce81d",
      "source/SourceSans3-Bold.ttf": "87b3daebd990ba83",
      "nunito/Nunito-Medium.ttf": "2590799f71eef8d4",
      "nunito/Nunito-SemiBold.ttf": "c7fd194467c320db",
      "nunito/Nunito-Bold.ttf": "ad443e47990c5fc4",
      "nunito/NunitoSans-Regular.ttf": "5539bb068f72fd45",
      "nunito/NunitoSans-Bold.ttf": "484d8229d8aed92f",
    };
    expect(Object.keys(expected).sort()).toEqual([...ALL_PAPER_FONT_FILES].sort());
    for (const [file, prefix] of Object.entries(expected)) {
      const hash = crypto.createHash("sha256").update(fs.readFileSync(`${FONT_ROOT}/${file}`)).digest("hex");
      expect([file, hash.slice(0, 16)]).toEqual([file, prefix]);
    }
  });

  it("the bundling scripts copy and verify exactly the registry's 15 files", () => {
    for (const script of ["scripts/prepare-server-pdf-deps.mjs", "scripts/verify-pdf-vendor.mjs"]) {
      const source = fs.readFileSync(`${process.cwd()}/${script}`, "utf8");
      for (const file of ALL_PAPER_FONT_FILES) expect([script, source.includes(`"${file}"`)]).toEqual([script, true]);
    }
  });

  it("ships an OFL text next to every font family", () => {
    for (const licence of [
      "stack-sans/OFL-StackSansNotch.txt",
      "stack-sans/OFL-StackSansText.txt",
      "source/OFL-SourceSerif4.txt",
      "source/OFL-SourceSans3.txt",
      "nunito/OFL-Nunito.txt",
      "nunito/OFL-NunitoSans.txt",
    ]) {
      expect(fs.readFileSync(`${FONT_ROOT}/${licence}`, "utf8")).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
    }
  });

  it("reads each font file once per process (buffers cached)", () => {
    registerPaperFonts(new PDFDocument({ bufferPages: true }), "round");
    const readSpy = jest.spyOn(fs, "readFileSync");
    try {
      registerPaperFonts(new PDFDocument({ bufferPages: true }), "round");
      expect(readSpy.mock.calls.filter(([p]) => String(p).includes("/nunito/"))).toHaveLength(0);
    } finally {
      readSpy.mockRestore();
    }
  });

  it("falls back to the Noto pair for every role when a style's files are missing", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const realExists = fs.existsSync;
    const existsSpy = jest
      .spyOn(fs, "existsSync")
      .mockImplementation((p) => (String(p).includes("stack-sans") ? false : realExists(p)));
    try {
      const doc = new PDFDocument({ bufferPages: true });
      const fonts = registerPaperFonts(doc, "invohub");
      expect(fonts.source).toBe("noto");
      expect(fonts.embedded).toBe(true);
      expect(fonts.body400).toBe(PDF_FONT_REGULAR);
      expect(fonts.head700).toBe(PDF_FONT_BOLD);
      expect(fonts.body700).toBe(PDF_FONT_BOLD);
    } finally {
      existsSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("falls back to Helvetica when nothing can be resolved", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    try {
      const fonts = registerPaperFonts(new PDFDocument({ bufferPages: true }), "classic");
      expect(fonts).toMatchObject({
        embedded: false,
        source: "helvetica",
        body400: FALLBACK_FONT_REGULAR,
        body700: FALLBACK_FONT_BOLD,
        head700: FALLBACK_FONT_BOLD,
      });
    } finally {
      existsSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
