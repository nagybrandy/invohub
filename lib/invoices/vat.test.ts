// lib/invoices/vat.test.ts
import {
  defaultVatExemptionReason,
  isExemptVatCategory,
  resolveVatExemptionReason,
  resolveVatRate,
  VAT_CATEGORIES,
  VAT_RATES,
} from "@/lib/invoices/vat";

describe("isExemptVatCategory", () => {
  it("is false only for normal", () => {
    expect(isExemptVatCategory("normal")).toBe(false);
    for (const category of VAT_CATEGORIES.filter((c) => c !== "normal")) {
      expect(isExemptVatCategory(category)).toBe(true);
    }
  });
});

describe("resolveVatRate", () => {
  it("keeps the chosen rate for normal lines", () => {
    expect(resolveVatRate("normal", 27)).toBe(27);
    expect(resolveVatRate("normal", 18)).toBe(18);
    expect(resolveVatRate("normal", 5)).toBe(5);
    expect(resolveVatRate("normal", 0)).toBe(0);
  });

  it("forces 0% for every exemption/reverse-charge category", () => {
    expect(resolveVatRate("AAM", 27)).toBe(0);
    expect(resolveVatRate("FAD", 27)).toBe(0);
    expect(resolveVatRate("ATK", 5)).toBe(0);
  });
});

describe("defaultVatExemptionReason", () => {
  it("returns undefined for normal", () => {
    expect(defaultVatExemptionReason("normal")).toBeUndefined();
  });

  it("returns the NAV-style reason for AAM", () => {
    expect(defaultVatExemptionReason("AAM")).toBe("Alanyi adómentes");
  });

  it("returns the NAV-style reason for FAD", () => {
    expect(defaultVatExemptionReason("FAD")).toBe("Fordított adózás");
  });

  it("defines a reason for every non-normal category", () => {
    for (const category of VAT_CATEGORIES.filter((c) => c !== "normal")) {
      expect(defaultVatExemptionReason(category)).toBeTruthy();
    }
  });
});

describe("resolveVatExemptionReason", () => {
  it("prefers an explicit reason over the default", () => {
    expect(resolveVatExemptionReason("AAM", "Custom reason")).toBe("Custom reason");
  });

  it("falls back to the category default when explicit reason is blank", () => {
    expect(resolveVatExemptionReason("AAM", "   ")).toBe("Alanyi adómentes");
  });

  it("returns undefined for normal with no explicit reason", () => {
    expect(resolveVatExemptionReason("normal")).toBeUndefined();
  });
});

describe("VAT_RATES", () => {
  it("includes the new 18% bracket alongside 0/5/27", () => {
    expect(VAT_RATES).toEqual([0, 5, 18, 27]);
  });
});
