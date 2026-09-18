// lib/invoices/exchange-rate.test.ts
import {
  formatExchangeRate,
  isMissingExchangeRate,
  parseExchangeRateInput,
  requiresExchangeRate,
  resolveExchangeRate,
  toHufAmount,
} from "@/lib/invoices/exchange-rate";

describe("requiresExchangeRate", () => {
  it("is true for a non-HUF currency and false for HUF", () => {
    expect(requiresExchangeRate("EUR")).toBe(true);
    expect(requiresExchangeRate("HUF")).toBe(false);
  });
});

describe("parseExchangeRateInput", () => {
  it("accepts a comma decimal separator (Hungarian keyboard)", () => {
    expect(parseExchangeRateInput("390,5")).toBe(390.5);
  });

  it("accepts a dot decimal separator", () => {
    expect(parseExchangeRateInput("390.5")).toBe(390.5);
  });

  it("returns null for blank, zero, negative or non-numeric input", () => {
    expect(parseExchangeRateInput("")).toBeNull();
    expect(parseExchangeRateInput("0")).toBeNull();
    expect(parseExchangeRateInput("-1")).toBeNull();
    expect(parseExchangeRateInput("abc")).toBeNull();
  });
});

describe("resolveExchangeRate", () => {
  it("always resolves a HUF invoice to rate 1, even with no stored rate", () => {
    expect(resolveExchangeRate({ currency: "HUF", exchangeRate: undefined })).toEqual({
      ok: true,
      rate: 1,
    });
  });

  it("ignores a stored rate on a HUF invoice — never applies it", () => {
    expect(resolveExchangeRate({ currency: "HUF", exchangeRate: 390 })).toEqual({
      ok: true,
      rate: 1,
    });
  });

  it("rejects a non-HUF invoice with no stored rate as missing", () => {
    expect(resolveExchangeRate({ currency: "EUR", exchangeRate: undefined })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("rejects a non-HUF invoice with a zero or negative rate as invalid", () => {
    expect(resolveExchangeRate({ currency: "EUR", exchangeRate: 0 })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(resolveExchangeRate({ currency: "EUR", exchangeRate: -1 })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("resolves a non-HUF invoice with a positive stored rate", () => {
    expect(resolveExchangeRate({ currency: "EUR", exchangeRate: 390.5 })).toEqual({
      ok: true,
      rate: 390.5,
    });
  });
});

describe("isMissingExchangeRate", () => {
  it("is false for a HUF invoice, even with no stored rate (AC1.1)", () => {
    expect(isMissingExchangeRate({ currency: "HUF", exchangeRate: undefined })).toBe(false);
  });

  it("is true for a non-HUF invoice with no stored rate (AC1.2)", () => {
    expect(isMissingExchangeRate({ currency: "EUR", exchangeRate: undefined })).toBe(true);
  });

  it("is true for a non-HUF invoice with a null stored rate (AC1.3)", () => {
    expect(
      isMissingExchangeRate({ currency: "EUR", exchangeRate: null as never })
    ).toBe(true);
  });

  it("is true for a non-HUF invoice with a zero or negative stored rate (AC1.4)", () => {
    expect(isMissingExchangeRate({ currency: "EUR", exchangeRate: 0 })).toBe(true);
    expect(isMissingExchangeRate({ currency: "EUR", exchangeRate: -3 })).toBe(true);
  });

  it("is false for a non-HUF invoice with a positive stored rate (AC1.5)", () => {
    expect(isMissingExchangeRate({ currency: "EUR", exchangeRate: 398.5 })).toBe(false);
  });

  it("agrees with resolveExchangeRate on every case (AC1.6)", () => {
    const cases: { currency: "HUF" | "EUR"; exchangeRate?: number }[] = [
      { currency: "HUF", exchangeRate: undefined },
      { currency: "HUF", exchangeRate: 390 },
      { currency: "EUR", exchangeRate: undefined },
      { currency: "EUR", exchangeRate: 0 },
      { currency: "EUR", exchangeRate: -1 },
      { currency: "EUR", exchangeRate: 390.5 },
    ];
    for (const invoice of cases) {
      const resolution = resolveExchangeRate(invoice);
      expect(isMissingExchangeRate(invoice)).toBe(!resolution.ok);
    }
  });
});

describe("toHufAmount", () => {
  it("rounds to 2 decimals", () => {
    expect(toHufAmount(100.005, 390.5)).toBe(39051.95);
  });

  it("converts an exact amount with no rounding needed", () => {
    expect(toHufAmount(200, 390.5)).toBe(78100);
  });
});

describe("formatExchangeRate", () => {
  it("trims trailing zeros and uses '.' as the decimal separator", () => {
    expect(formatExchangeRate(390.5)).toBe("390.5");
  });

  it("emits a whole rate with no decimal point", () => {
    expect(formatExchangeRate(1)).toBe("1");
  });
});
