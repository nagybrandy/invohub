import { getSupportedCurrencies, resetSupportedCurrenciesCache } from "@/lib/exchange-rates/currencies";

const rate = (currency: string) => ({ date: "2026-10-21", currency, unit: 1, rate: 100 });
const LIVE = ["EUR", "USD", "GBP", "CHF", "PLN", "CZK", "JPY"].map(rate);

describe("getSupportedCurrencies", () => {
  beforeEach(() => resetSupportedCurrenciesCache());

  it("offers HUF + the currencies the MNB currently publishes, primaries first", async () => {
    const out = await getSupportedCurrencies(1000, async () => LIVE);
    expect(out.source).toBe("mnb");
    expect(out.currencies).toEqual(["HUF", "EUR", "USD", "GBP", "CHF", "CZK", "JPY", "PLN"]);
  });

  it("does not offer a currency the MNB no longer publishes", async () => {
    const out = await getSupportedCurrencies(1000, async () => LIVE);
    expect(out.currencies).not.toContain("HRK");
    expect(out.currencies).not.toContain("RUB");
  });

  it("caches for a few hours, then asks again", async () => {
    const fetchRates = jest.fn(async () => LIVE);
    await getSupportedCurrencies(0, fetchRates);
    await getSupportedCurrencies(60 * 60 * 1000, fetchRates);
    expect(fetchRates).toHaveBeenCalledTimes(1);
    await getSupportedCurrencies(7 * 60 * 60 * 1000, fetchRates);
    expect(fetchRates).toHaveBeenCalledTimes(2);
  });

  it("falls back to the static list when the MNB is unreachable or answers nonsense", async () => {
    const down = await getSupportedCurrencies(0, async () => {
      throw new Error("MNB down");
    });
    expect(down.source).toBe("fallback");
    expect(down.currencies.slice(0, 4)).toEqual(["HUF", "EUR", "USD", "GBP"]);
    expect(down.currencies.length).toBeGreaterThan(20);

    resetSupportedCurrenciesCache();
    expect((await getSupportedCurrencies(0, async () => [])).source).toBe("fallback");
  });
});
