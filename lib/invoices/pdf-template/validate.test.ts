// lib/invoices/pdf-template/validate.test.ts
import { validatePdfTemplateInput } from "@/lib/invoices/pdf-template/validate";

function ok(body: unknown) {
  const result = validatePdfTemplateInput(body);
  if (!result.ok) throw new Error(`expected ok, got fields ${result.fields.join(",")}`);
  return result.value;
}
function failed(body: unknown): string[] {
  const result = validatePdfTemplateInput(body);
  if (result.ok) throw new Error("expected a validation failure");
  return result.fields;
}

describe("validatePdfTemplateInput", () => {
  it("accepts an empty object as an empty (all optional) input", () => {
    expect(ok({})).toEqual({});
  });

  it.each([null, undefined, "x", 3, true, [], [1]])("rejects a body that is not a JSON object: %p", (body) => {
    expect(failed(body)).toEqual(["body"]);
  });

  it("ignores unknown keys and never returns them", () => {
    expect(ok({ titleText: "X", evil: "<script>", id: "x", userId: "someone" })).toEqual({ titleText: "X" });
  });

  describe.each([
    ["layout", ["clean", "band", "frame"], ["legacy", "hologram", "", 1, null, "Frame"]],
    ["fontStyle", ["invohub", "classic", "round"], ["custom", "serif", "", 2, null]],
    ["logoMode", ["monogram", "own", "none"], ["svg", "", 0, null]],
    ["logoSize", ["S", "M", "L"], ["XL", "s", "", 1, null]],
    ["logoPosition", ["left", "right"], ["top", "Left", "", null]],
    ["fontScale", ["small", "medium", "large"], ["huge", "", 1, null]],
  ])("%s", (field, good, bad) => {
    it.each(good as string[])("accepts %p", (value) => {
      expect(ok({ [field as string]: value })).toEqual({ [field as string]: value });
    });
    it.each(bad as unknown[])("rejects %p", (value) => {
      expect(failed({ [field as string]: value })).toEqual([field]);
    });
  });

  describe("accentColor", () => {
    it("accepts #RRGGBB as is (keeping the case)", () => {
      expect(ok({ accentColor: "#3F6BC4" })).toEqual({ accentColor: "#3F6BC4" });
      expect(ok({ accentColor: "#aabbcc" })).toEqual({ accentColor: "#aabbcc" });
    });
    it("expands #RGB to six digits", () => {
      expect(ok({ accentColor: "#abc" })).toEqual({ accentColor: "#aabbcc" });
      expect(ok({ accentColor: "#F0A" })).toEqual({ accentColor: "#FF00AA" });
    });
    it.each(["red", "3F6BC4", "#12", "#12345", "#1234567", "#gggggg", "", "#abc; } body {", 5, null, {}])(
      "rejects %p without a silent fallback",
      (value) => {
        expect(failed({ accentColor: value })).toEqual(["accentColor"]);
      }
    );
    it("trims surrounding whitespace", () => {
      expect(ok({ accentColor: " #3F6BC4 " })).toEqual({ accentColor: "#3F6BC4" });
    });
  });

  describe.each(["showCompanyBlock", "showBankDetails", "showClientTaxNumber"])("%s", (field) => {
    it("accepts booleans", () => {
      expect(ok({ [field]: false })).toEqual({ [field]: false });
      expect(ok({ [field]: true })).toEqual({ [field]: true });
    });
    it.each(["true", "false", 1, 0, null, {}])("rejects %p", (value) => {
      expect(failed({ [field]: value })).toEqual([field]);
    });
  });

  describe("text fields", () => {
    it("trims titleText and notesLabel and caps them at 40 characters", () => {
      expect(ok({ titleText: "  SZÁMLA  " })).toEqual({ titleText: "SZÁMLA" });
      expect(ok({ notesLabel: "x".repeat(40) })).toEqual({ notesLabel: "x".repeat(40) });
      expect(failed({ titleText: "x".repeat(41) })).toEqual(["titleText"]);
      expect(failed({ notesLabel: "x".repeat(41) })).toEqual(["notesLabel"]);
    });
    it("trims footerText and caps it at 200 characters; an empty footer is allowed", () => {
      expect(ok({ footerText: " Köszönjük! " })).toEqual({ footerText: "Köszönjük!" });
      expect(ok({ footerText: "" })).toEqual({ footerText: "" });
      expect(ok({ footerText: "y".repeat(200) })).toEqual({ footerText: "y".repeat(200) });
      expect(failed({ footerText: "y".repeat(201) })).toEqual(["footerText"]);
    });
    it.each(["titleText", "notesLabel", "footerText"])("%s must be a string", (field) => {
      expect(failed({ [field]: 5 })).toEqual([field]);
      expect(failed({ [field]: null })).toEqual([field]);
      expect(failed({ [field]: ["a"] })).toEqual([field]);
    });
  });

  it("reports every invalid field, in a stable order, and none of the valid ones", () => {
    expect(
      failed({ layout: "x", accentColor: "red", titleText: "ok", showBankDetails: "no", logoSize: "XL" })
    ).toEqual(["layout", "logoSize", "accentColor", "showBankDetails"]);
  });

  it("accepts a full template as the settings screen sends it", () => {
    const full = {
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
    };
    expect(ok(full)).toEqual(full);
  });
});

describe("validatePdfTemplateInput with the stored template", () => {
  const long = "x".repeat(300);
  it("accepts an over-limit text that equals the stored one, but no other over-limit text", () => {
    expect(validatePdfTemplateInput({ footerText: long }, { footerText: long })).toEqual({
      ok: true,
      value: { footerText: long },
    });
    expect(validatePdfTemplateInput({ footerText: `${long}y` }, { footerText: long })).toEqual({
      ok: false,
      fields: ["footerText"],
    });
    expect(validatePdfTemplateInput({ footerText: long }, null)).toEqual({ ok: false, fields: ["footerText"] });
  });
});
