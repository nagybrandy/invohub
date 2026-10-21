import {
  FALLBACK_MNB_CURRENCIES,
  PRIMARY_CURRENCIES,
  currencyFractionDigits,
  currencySymbol,
  isCurrencyCode,
  orderCurrencies,
} from "@/lib/currency/currencies";

describe("currencies", () => {
  it("accepts ISO-4217-shaped codes only", () => {
    for (const ok of ["HUF", "EUR", "USD", "GBP", "CHF"]) expect(isCurrencyCode(ok)).toBe(true);
    for (const bad of ["eur", "EURO", "EU", "", "123", null, undefined, 5]) expect(isCurrencyCode(bad)).toBe(false);
  });

  it("knows the symbols people expect and falls back to the code", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("HUF")).toBe("Ft");
    expect(currencySymbol("CHF")).toBe("CHF");
  });

  it("uses whole forints but cents for the others (and no decimals for JPY)", () => {
    expect(currencyFractionDigits("HUF")).toBe(0);
    expect(currencyFractionDigits("EUR")).toBe(2);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("XYZ")).toBeGreaterThanOrEqual(0);
  });

  it("puts HUF, EUR, USD, GBP first and sorts the rest", () => {
    expect(orderCurrencies(["CHF", "USD", "AUD", "EUR", "CHF"])).toEqual([...PRIMARY_CURRENCIES, "AUD", "CHF"]);
  });

  it("the fallback list has no forint, no dropped kuna, and covers the four primaries", () => {
    expect(FALLBACK_MNB_CURRENCIES).not.toContain("HUF");
    expect(FALLBACK_MNB_CURRENCIES).not.toContain("HRK");
    for (const c of ["EUR", "USD", "GBP"]) expect(FALLBACK_MNB_CURRENCIES).toContain(c);
  });
});
