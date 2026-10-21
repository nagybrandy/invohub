import { normalizeInvoicePrefix, validateBillingSettings } from "@/lib/companies/billing-settings";

describe("normalizeInvoicePrefix", () => {
  it("upper-cases a 1–10 character alphanumeric prefix", () => {
    expect(normalizeInvoicePrefix(" dc ")).toBe("DC");
    expect(normalizeInvoicePrefix("SG2")).toBe("SG2");
  });
  it("rejects empty, dashed, spaced, accented or too long prefixes", () => {
    for (const bad of ["", "  ", "D-C", "D C", "ÁB", "ABCDEFGHIJK", null, undefined]) {
      expect(normalizeInvoicePrefix(bad as string | null | undefined)).toBeNull();
    }
  });
});

describe("validateBillingSettings", () => {
  it("accepts a full valid set", () => {
    const { values, errors } = validateBillingSettings({
      taxMode: "atalanyado", vatRegime: "quarterly", hipaMode: "banded", invoicePrefix: "dc",
      defaultPaymentMethod: "card", defaultPaymentTermDays: 15, defaultCurrency: "EUR",
      defaultLanguage: "en", defaultVatRate: 27, defaultNote: "  Köszönjük!  ",
    });
    expect(errors).toEqual([]);
    expect(values).toEqual({
      taxMode: "atalanyado", vatRegime: "quarterly", hipaMode: "banded", invoicePrefix: "DC",
      defaultPaymentMethod: "card", defaultPaymentTermDays: 15, defaultCurrency: "EUR",
      defaultLanguage: "en", defaultVatRate: 27, defaultNote: "Köszönjük!",
    });
  });

  it("covers every tax mode, VAT regime and HIPA mode the spec lists", () => {
    for (const taxMode of ["kata", "atalanyado", "vszja", "tao", "kiva"]) expect(validateBillingSettings({ taxMode }).errors).toEqual([]);
    for (const vatRegime of ["aam", "monthly", "quarterly", "yearly"]) expect(validateBillingSettings({ vatRegime }).errors).toEqual([]);
    for (const hipaMode of ["banded", "general"]) expect(validateBillingSettings({ hipaMode }).errors).toEqual([]);
  });

  it("reports invalid values instead of applying or silently dropping them", () => {
    const { values, errors } = validateBillingSettings({
      taxMode: "bt", vatRegime: "weekly", invoicePrefix: "a-b", defaultPaymentTermDays: -1,
      defaultVatRate: 20, defaultLanguage: "xx", defaultCurrency: "euro", defaultPaymentMethod: "bitcoin",
    });
    expect(values).toEqual({});
    expect(errors.map((e) => e.field).sort()).toEqual(
      ["defaultCurrency", "defaultLanguage", "defaultPaymentMethod", "defaultPaymentTermDays", "defaultVatRate", "invoicePrefix", "taxMode", "vatRegime"].sort(),
    );
  });

  it("clears a field with null / empty string and leaves absent fields alone", () => {
    const { values } = validateBillingSettings({ taxMode: "", invoicePrefix: null, defaultNote: "   " });
    expect(values).toEqual({ taxMode: null, invoicePrefix: null, defaultNote: null });
    expect(validateBillingSettings({}).values).toEqual({});
  });

  it("rejects an over-long default note and a non-integer payment term", () => {
    expect(validateBillingSettings({ defaultNote: "x".repeat(1001) }).errors).toHaveLength(1);
    expect(validateBillingSettings({ defaultPaymentTermDays: 7.5 }).errors).toHaveLength(1);
    expect(validateBillingSettings({ defaultPaymentTermDays: 400 }).errors).toHaveLength(1);
  });
});
