// components/invoices/composer/composer-view.test.ts
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import {
  daysBetween,
  highlightParts,
  parseVatSelectValue,
  previewPresentation,
  previousMonthEndIso,
  recentInvoicesForCopy,
  vatSelectValue,
} from "@/components/invoices/composer/composer-view";

describe("previewPresentation", () => {
  it("opens the preview as a side column from 1100px and as a sheet below", () => {
    expect(previewPresentation(1440)).toBe("side");
    expect(previewPresentation(1100)).toBe("side");
    expect(previewPresentation(1099)).toBe("sheet");
    expect(previewPresentation(375)).toBe("sheet");
  });
});

describe("daysBetween", () => {
  it("counts whole days between two ISO dates", () => {
    expect(daysBetween("2026-11-03", "2026-11-11")).toBe(8);
    expect(daysBetween("2026-11-03", "2026-11-03")).toBe(0);
    expect(daysBetween("2026-11-11", "2026-11-03")).toBe(-8);
  });

  it("is not thrown off by a daylight-saving change", () => {
    expect(daysBetween("2026-03-25", "2026-04-02")).toBe(8);
  });

  it("returns null for something that is not a date", () => {
    expect(daysBetween("", "2026-11-03")).toBeNull();
    expect(daysBetween("2026-11-03", "nope")).toBeNull();
  });
});

describe("previousMonthEndIso", () => {
  it("returns the last day of the previous month", () => {
    expect(previousMonthEndIso("2026-11-03")).toBe("2026-10-31");
    expect(previousMonthEndIso("2026-03-15")).toBe("2026-02-28");
    expect(previousMonthEndIso("2028-03-01")).toBe("2028-02-29");
  });

  it("crosses the year boundary", () => {
    expect(previousMonthEndIso("2026-01-09")).toBe("2025-12-31");
  });
});

describe("highlightParts", () => {
  it("splits around the first case-insensitive match", () => {
    expect(highlightParts("Zöld Energia Zrt.", "zö")).toEqual({ before: "", match: "Zö", after: "ld Energia Zrt." });
    expect(highlightParts("Acme Zöld", "ZÖ")).toEqual({ before: "Acme ", match: "Zö", after: "ld" });
  });

  it("leaves the text whole when nothing matches or the query is empty", () => {
    expect(highlightParts("Acme", "zz")).toEqual({ before: "Acme", match: "", after: "" });
    expect(highlightParts("Acme", "  ")).toEqual({ before: "Acme", match: "", after: "" });
  });
});

describe("recentInvoicesForCopy", () => {
  it("keeps the first five, in order, and skips storno documents", () => {
    const list = [
      makeInvoice({ id: "1" }),
      makeInvoice({ id: "s", documentType: "storno" }),
      makeInvoice({ id: "2" }),
      makeInvoice({ id: "3" }),
      makeInvoice({ id: "4" }),
      makeInvoice({ id: "5" }),
      makeInvoice({ id: "6" }),
    ];
    expect(recentInvoicesForCopy(list).map((i) => i.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("copes with a list that has not loaded", () => {
    expect(recentInvoicesForCopy(undefined)).toEqual([]);
  });
});

describe("VAT select values", () => {
  it("round-trips a taxed rate and an exempt category", () => {
    expect(vatSelectValue("normal", 27)).toBe("normal:27");
    expect(parseVatSelectValue("normal:27")).toEqual({ category: "normal", rate: 27 });
    expect(vatSelectValue("AAM", 0)).toBe("AAM");
    expect(parseVatSelectValue("AAM")).toEqual({ category: "AAM", rate: null });
  });
});
