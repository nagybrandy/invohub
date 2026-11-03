// lib/invoices/pdf-template/defaults.test.ts
import {
  DEFAULT_PDF_TEMPLATE,
  LEGACY_PDF_TEMPLATE,
  applyPdfTemplateInput,
  localizePdfTemplate,
  mergePdfTemplate,
  normalizeHexColor,
  parsePdfTemplateSnapshot,
  pdfFontSizes,
} from "@/lib/invoices/pdf-template/defaults";

describe("LEGACY_PDF_TEMPLATE", () => {
  it("freezes today's values (cornflower accent, old footer, fontScale) and the legacy layout", () => {
    expect(LEGACY_PDF_TEMPLATE).toEqual({
      titleText: "SZÁMLA",
      accentColor: "#6495ed",
      showCompanyBlock: true,
      showBankDetails: true,
      showClientTaxNumber: true,
      footerText: "Köszönjük a bizalmat!",
      notesLabel: "Megjegyzés",
      fontScale: "medium",
      layout: "legacy",
      fontStyle: "invohub",
      logoMode: "monogram",
      logoSize: "M",
      logoPosition: "left",
    });
  });
});

describe("DEFAULT_PDF_TEMPLATE (Dóri's defaults)", () => {
  it("is the Keretes / InvoHub / Monogram M left design in #3F6BC4 with every toggle on", () => {
    expect(DEFAULT_PDF_TEMPLATE).toEqual({
      titleText: "SZÁMLA",
      accentColor: "#3F6BC4",
      showCompanyBlock: true,
      showBankDetails: true,
      showClientTaxNumber: true,
      footerText: "Köszönjük a bizalmát!",
      notesLabel: "Megjegyzés",
      fontScale: "medium",
      layout: "frame",
      fontStyle: "invohub",
      logoMode: "monogram",
      logoSize: "M",
      logoPosition: "left",
    });
  });
});

describe("mergePdfTemplate", () => {
  it("fills defaults for partial input", () => {
    expect(mergePdfTemplate({ titleText: "CUSTOM" })).toEqual({
      ...DEFAULT_PDF_TEMPLATE,
      titleText: "CUSTOM",
    });
  });

  it("with no input, matches the new defaults", () => {
    expect(mergePdfTemplate({})).toEqual(DEFAULT_PDF_TEMPLATE);
  });

  it("merges onto an explicit base, ignoring undefined values", () => {
    expect(mergePdfTemplate({ accentColor: undefined, titleText: "X" }, LEGACY_PDF_TEMPLATE)).toEqual({
      ...LEGACY_PDF_TEMPLATE,
      titleText: "X",
    });
  });
});

describe("normalizeHexColor", () => {
  it("accepts valid hex colors", () => {
    expect(normalizeHexColor("#aabbcc")).toBe("#aabbcc");
  });

  it("falls back to the frozen legacy cornflower for invalid colors (the legacy renderer depends on it)", () => {
    expect(normalizeHexColor("nope")).toBe("#6495ed");
    expect(normalizeHexColor("red")).toBe(LEGACY_PDF_TEMPLATE.accentColor);
  });

  it("takes an explicit fallback", () => {
    expect(normalizeHexColor("nope", DEFAULT_PDF_TEMPLATE.accentColor)).toBe("#3F6BC4");
    expect(normalizeHexColor("#aabbcc", DEFAULT_PDF_TEMPLATE.accentColor)).toBe("#aabbcc");
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
  it("compares the footer against the default set of the template's own layout", () => {
    // legacy: only the old default is a default
    expect(localizePdfTemplate(LEGACY_PDF_TEMPLATE, "en").footerText).toBe("Thank you for your business!");
    expect(
      localizePdfTemplate({ ...LEGACY_PDF_TEMPLATE, footerText: "Köszönjük a bizalmát!" }, "en").footerText
    ).toBe("Köszönjük a bizalmát!");
    // new layouts: the legacy default footer (a row switched from legacy by an
    // older client) is a default too, so an English document never prints Hungarian
    expect(
      localizePdfTemplate({ ...DEFAULT_PDF_TEMPLATE, footerText: "Köszönjük a bizalmat!" }, "en").footerText
    ).toBe("Thank you for your business!");
    expect(localizePdfTemplate({ ...LEGACY_PDF_TEMPLATE, layout: "frame" }, "en").footerText).toBe(
      "Thank you for your business!"
    );
    expect(localizePdfTemplate({ ...DEFAULT_PDF_TEMPLATE, layout: "band" }, "en").footerText).toBe(
      "Thank you for your business!"
    );
  });
  it("never touches a text the user customised, nor a Hungarian document", () => {
    const custom = { ...DEFAULT_PDF_TEMPLATE, titleText: "ÁFÁS SZÁMLA", footerText: "Viszlát!" };
    expect(localizePdfTemplate(custom, "en")).toMatchObject({ titleText: "ÁFÁS SZÁMLA", footerText: "Viszlát!", notesLabel: "Note" });
    expect(localizePdfTemplate(DEFAULT_PDF_TEMPLATE, "hu")).toBe(DEFAULT_PDF_TEMPLATE);
  });
});

const LEGACY_ONLY_DEFAULTS = {
  layout: "legacy",
  fontStyle: "invohub",
  logoMode: "monogram",
  logoSize: "M",
  logoPosition: "left",
};

describe("parsePdfTemplateSnapshot", () => {
  it("returns null when there is no snapshot (draft, or an invoice issued before snapshots existed)", () => {
    expect(parsePdfTemplateSnapshot(null)).toBeNull();
    expect(parsePdfTemplateSnapshot(undefined)).toBeNull();
    expect(parsePdfTemplateSnapshot("SZÁMLA")).toBeNull();
    expect(parsePdfTemplateSnapshot([1, 2])).toBeNull();
  });

  it("returns the stored appearance as it was at issue time", () => {
    const stored = {
      titleText: "SZÁMLA",
      accentColor: "#ff0000",
      showCompanyBlock: false,
      showBankDetails: true,
      showClientTaxNumber: false,
      footerText: "Régi lábléc",
      notesLabel: "Megj.",
      fontScale: "large",
    };
    // A snapshot written before the paper redesign has no layout: it is legacy.
    expect(parsePdfTemplateSnapshot(stored)).toEqual({ ...stored, ...LEGACY_ONLY_DEFAULTS });
  });

  it("treats a snapshot without a layout, or with an unknown one, as legacy and fills the rest from LEGACY", () => {
    expect(parsePdfTemplateSnapshot({})).toEqual(LEGACY_PDF_TEMPLATE);
    expect(parsePdfTemplateSnapshot({ layout: "hologram", fontStyle: "serif" })).toEqual(LEGACY_PDF_TEMPLATE);
    expect(parsePdfTemplateSnapshot({ layout: 3 })?.layout).toBe("legacy");
  });

  it("round-trips a full new-shape snapshot", () => {
    const stored = {
      ...DEFAULT_PDF_TEMPLATE,
      layout: "band",
      fontStyle: "classic",
      logoMode: "none",
      logoSize: "L",
      logoPosition: "right",
      accentColor: "#E8590C",
    };
    expect(parsePdfTemplateSnapshot(stored)).toEqual(stored);
  });

  it("keeps each valid new field and drops an invalid one back to the legacy value", () => {
    const parsed = parsePdfTemplateSnapshot({
      layout: "frame",
      fontStyle: "round",
      logoMode: "sparkles",
      logoSize: "XL",
      logoPosition: "right",
    });
    expect(parsed).toMatchObject({
      layout: "frame",
      fontStyle: "round",
      logoMode: LEGACY_PDF_TEMPLATE.logoMode,
      logoSize: LEGACY_PDF_TEMPLATE.logoSize,
      logoPosition: "right",
    });
  });

  it("sanitizes a malformed stored snapshot instead of trusting it — the render path's safety must not depend on the row", () => {
    const parsed = parsePdfTemplateSnapshot({
      titleText: 42,
      accentColor: "red; } body { display: none",
      showCompanyBlock: "yes",
      fontScale: "huge",
      footerText: "Saved footer",
      injected: "<script>",
    });
    expect(parsed).toEqual({
      ...LEGACY_PDF_TEMPLATE,
      footerText: "Saved footer",
    });
    expect(parsed).not.toHaveProperty("injected");
  });
});

describe("applyPdfTemplateInput", () => {
  it("an omitted field means 'as saved' (a legacy row stays legacy)", () => {
    expect(applyPdfTemplateInput(LEGACY_PDF_TEMPLATE, { showBankDetails: false })).toEqual({
      ...LEGACY_PDF_TEMPLATE,
      showBankDetails: false,
    });
  });

  it("moving a legacy row to a paper layout swaps the never-edited legacy defaults for Dóri's", () => {
    const out = applyPdfTemplateInput(LEGACY_PDF_TEMPLATE, { layout: "frame" });
    expect(out).toEqual({ ...DEFAULT_PDF_TEMPLATE, layout: "frame" });
    expect(localizePdfTemplate(out, "en").footerText).toBe("Thank you for your business!");
  });

  it("keeps what the user did edit, and what the same request sets explicitly", () => {
    const stored = { ...LEGACY_PDF_TEMPLATE, accentColor: "#112233", footerText: "Viszlát!" };
    const out = applyPdfTemplateInput(stored, { layout: "band", notesLabel: "Jegyzet" });
    expect(out).toMatchObject({ layout: "band", accentColor: "#112233", footerText: "Viszlát!", notesLabel: "Jegyzet" });
    const explicit = applyPdfTemplateInput(LEGACY_PDF_TEMPLATE, { layout: "clean", accentColor: "#6495ed" });
    expect(explicit.accentColor).toBe("#6495ed");
  });

  it("does not touch a row that is already on a paper layout", () => {
    const stored = { ...DEFAULT_PDF_TEMPLATE, layout: "band" as const };
    expect(applyPdfTemplateInput(stored, { layout: "clean" })).toEqual({ ...stored, layout: "clean" });
  });
});
