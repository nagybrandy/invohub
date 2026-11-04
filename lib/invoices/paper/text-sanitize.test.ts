// lib/invoices/paper/text-sanitize.test.ts
/** @jest-environment node */
import PDFDocument from "pdfkit";
import { sanitizePaperText } from "@/lib/invoices/paper/text-sanitize";
import { PAPER_FONT_ROLES, registerPaperFonts } from "@/lib/invoices/pdf-fonts";
import type { PdfFontStyle } from "@/lib/invoices/pdf-template/types";

// What people paste into a description, a note or a customer name.
const PASTED =
  "Ő Ű ő ű – — „idézet” ‘x’ ’ € … • × ° ½ § © ® a‑b‐c‒d e f­g​h﻿iʼj № 5";

describe("sanitizePaperText", () => {
  it("maps the code points the paper fonts lack to plain equivalents", () => {
    expect(sanitizePaperText("a‑b")).toBe("a-b");
    expect(sanitizePaperText("1 000 Ft")).toBe("1 000 Ft");
    expect(sanitizePaperText("so­ft​zero﻿")).toBe("softzero");
    expect(sanitizePaperText("№ 5")).toBe("No. 5");
    expect(sanitizePaperText("dʼa")).toBe("d’a");
  });

  it("leaves Hungarian letters, quotes, dashes, NBSP and the euro sign alone, and is idempotent", () => {
    const keep = "Őrült Űrhajós ő ű – — „idézet” € ";
    expect(sanitizePaperText(keep)).toBe(keep);
    expect(sanitizePaperText(sanitizePaperText(PASTED))).toBe(sanitizePaperText(PASTED));
  });
});

describe("every paper font covers the sanitized pasted set (no .notdef boxes)", () => {
  const styles: PdfFontStyle[] = ["invohub", "classic", "round"];
  it.each(styles)("%s", (style) => {
    const doc = new PDFDocument();
    const fonts = registerPaperFonts(doc, style);
    expect(fonts.embedded).toBe(true);
    const text = sanitizePaperText(PASTED);
    for (const role of PAPER_FONT_ROLES) {
      doc.font(fonts[role]);
      const font = (doc as unknown as { _font: { font: { hasGlyphForCodePoint(cp: number): boolean } } })._font.font;
      const missing = [...text].filter((ch) => !/\s/.test(ch) && !font.hasGlyphForCodePoint(ch.codePointAt(0)!));
      expect({ role, missing }).toEqual({ role, missing: [] });
    }
  });
});
