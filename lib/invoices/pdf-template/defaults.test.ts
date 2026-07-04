// lib/invoices/pdf-template/defaults.test.ts
import {
  DEFAULT_PDF_TEMPLATE,
  mergePdfTemplate,
  normalizeHexColor,
  pdfFontSizes,
} from "@/lib/invoices/pdf-template/defaults";

describe("mergePdfTemplate", () => {
  it("fills defaults for partial input", () => {
    expect(mergePdfTemplate({ titleText: "SZÁMLA" })).toEqual({
      ...DEFAULT_PDF_TEMPLATE,
      titleText: "SZÁMLA",
    });
  });
});

describe("normalizeHexColor", () => {
  it("accepts valid hex colors", () => {
    expect(normalizeHexColor("#aabbcc")).toBe("#aabbcc");
  });

  it("falls back for invalid colors", () => {
    expect(normalizeHexColor("red")).toBe(DEFAULT_PDF_TEMPLATE.accentColor);
  });
});

describe("pdfFontSizes", () => {
  it("returns larger sizes for large scale", () => {
    expect(pdfFontSizes("large").title).toBeGreaterThan(pdfFontSizes("small").title);
  });
});
