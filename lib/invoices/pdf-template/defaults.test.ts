// lib/invoices/pdf-template/defaults.test.ts
import {
  DEFAULT_PDF_TEMPLATE,
  localizePdfTemplate,
  mergePdfTemplate,
  normalizeHexColor,
  pdfFontSizes,
} from "@/lib/invoices/pdf-template/defaults";

describe("DEFAULT_PDF_TEMPLATE", () => {
  it("is the Hungarian/InvoHub-branded default (SZÁMLA, cornflower accent)", () => {
    expect(DEFAULT_PDF_TEMPLATE.titleText).toBe("SZÁMLA");
    expect(DEFAULT_PDF_TEMPLATE.accentColor).toBe("#6495ed");
    expect(DEFAULT_PDF_TEMPLATE.notesLabel).toBe("Megjegyzés");
    expect(DEFAULT_PDF_TEMPLATE.footerText).toBe("Köszönjük a bizalmat!");
  });
});

describe("mergePdfTemplate", () => {
  it("fills defaults for partial input", () => {
    expect(mergePdfTemplate({ titleText: "CUSTOM" })).toEqual({
      ...DEFAULT_PDF_TEMPLATE,
      titleText: "CUSTOM",
    });
  });

  it("with no input, matches the new Hungarian defaults", () => {
    expect(mergePdfTemplate({})).toEqual(DEFAULT_PDF_TEMPLATE);
  });
});

describe("normalizeHexColor", () => {
  it("accepts valid hex colors", () => {
    expect(normalizeHexColor("#aabbcc")).toBe("#aabbcc");
  });

  it("falls back to the cornflower default for invalid colors", () => {
    expect(normalizeHexColor("nope")).toBe("#6495ed");
    expect(normalizeHexColor("red")).toBe(DEFAULT_PDF_TEMPLATE.accentColor);
  });
});

describe("pdfFontSizes", () => {
  it("returns larger sizes for large scale", () => {
    expect(pdfFontSizes("large").title).toBeGreaterThan(pdfFontSizes("small").title);
  });
});

describe("localizePdfTemplate", () => {
  it("turns the default Hungarian texts English for an English document", () => {
    const out = localizePdfTemplate(DEFAULT_PDF_TEMPLATE, "en");
    expect(out).toMatchObject({ titleText: "INVOICE", footerText: "Thank you for your business!", notesLabel: "Note" });
    expect(out.accentColor).toBe(DEFAULT_PDF_TEMPLATE.accentColor);
  });
  it("never touches a text the user customised, nor a Hungarian document", () => {
    const custom = { ...DEFAULT_PDF_TEMPLATE, titleText: "ÁFÁS SZÁMLA", footerText: "Viszlát!" };
    expect(localizePdfTemplate(custom, "en")).toMatchObject({ titleText: "ÁFÁS SZÁMLA", footerText: "Viszlát!", notesLabel: "Note" });
    expect(localizePdfTemplate(DEFAULT_PDF_TEMPLATE, "hu")).toBe(DEFAULT_PDF_TEMPLATE);
  });
});
