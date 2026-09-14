// lib/i18n/locales/en.test.ts
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";

describe("i18n en locale", () => {
  it("defines navigation keys", () => {
    expect(en.nav.invoices).toBe("Invoices");
    expect(en.nav.dashboard).toBe("Dashboard");
    expect(en.settings.darkMode).toBe("Dark mode");
  });
});

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("hu/en locale parity", () => {
  it("defines the exact same set of keys in both locales", () => {
    const enKeys = keyPaths(en).sort();
    const huKeys = keyPaths(hu).sort();
    expect(huKeys).toEqual(enKeys);
  });

  it("defines the new invoices.vat/lineItemEditor/markPaid/correction/links/edit keys in both locales", () => {
    for (const locale of [en, hu]) {
      expect(locale.invoices.vat.category.AAM).toBeTruthy();
      expect(locale.invoices.lineItemEditor.addLineItem).toBeTruthy();
      expect(locale.invoices.markPaid.action).toBeTruthy();
      expect(locale.invoices.correction.action).toBeTruthy();
      expect(locale.invoices.links.stornoOf).toBeTruthy();
      expect(locale.invoices.edit.title).toBeTruthy();
      expect(locale.company.vatExempt).toBeTruthy();
    }
  });
});
