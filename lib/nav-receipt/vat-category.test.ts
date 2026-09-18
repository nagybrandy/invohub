// lib/nav-receipt/vat-category.test.ts
import { NAV_VAT_CATEGORIES, toNavVatCategory } from "@/lib/nav-receipt/vat-category";

const VAT_CATEGORY_NAME_PATTERN = /^[A-Za-z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ% ]*$/;

describe("toNavVatCategory", () => {
  it("maps the four published percentage rates", () => {
    expect(toNavVatCategory(0)).toBe("0%");
    expect(toNavVatCategory(5)).toBe("5%");
    expect(toNavVatCategory(18)).toBe("18%");
    expect(toNavVatCategory(27)).toBe("27%");
  });

  it("maps any rate to Alanyi adómentes when the company is vatExempt", () => {
    expect(toNavVatCategory(0, { vatExempt: true })).toBe("Alanyi adómentes");
    expect(toNavVatCategory(27, { vatExempt: true })).toBe("Alanyi adómentes");
  });

  it("maps an unrecognized rate to Egyéb", () => {
    expect(toNavVatCategory(12)).toBe("Egyéb");
    expect(toNavVatCategory(-1)).toBe("Egyéb");
  });

  it("never emits any string outside the single NAV_VAT_CATEGORIES constant", () => {
    const allowed = new Set(Object.values(NAV_VAT_CATEGORIES));
    for (const rate of [0, 5, 18, 27, 12, 99, -1]) {
      for (const vatExempt of [true, false]) {
        expect(allowed.has(toNavVatCategory(rate, { vatExempt }))).toBe(true);
      }
    }
  });

  it("every category name matches VatCategoryNameType's pattern and is <= 50 chars", () => {
    for (const name of Object.values(NAV_VAT_CATEGORIES)) {
      expect(name.length).toBeLessThanOrEqual(50);
      expect(name).toMatch(VAT_CATEGORY_NAME_PATTERN);
    }
  });
});
