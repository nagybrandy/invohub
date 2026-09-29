// lib/exchange-rates/service.test.ts
jest.mock("@/lib/exchange-rates/cache", () => ({
  getCachedRate: jest.fn(),
  saveRates: jest.fn(),
}));

jest.mock("@/lib/exchange-rates/mnb", () => {
  const actual = jest.requireActual("@/lib/exchange-rates/mnb");
  return {
    ...actual,
    fetchMnbExchangeRates: jest.fn(),
  };
});

import { getCachedRate, saveRates } from "@/lib/exchange-rates/cache";
import { MnbFetchError, fetchMnbExchangeRates } from "@/lib/exchange-rates/mnb";
import { getExchangeRate } from "@/lib/exchange-rates/service";

const mockGetCachedRate = getCachedRate as jest.MockedFunction<typeof getCachedRate>;
const mockSaveRates = saveRates as jest.MockedFunction<typeof saveRates>;
const mockFetchMnb = fetchMnbExchangeRates as jest.MockedFunction<typeof fetchMnbExchangeRates>;

describe("getExchangeRate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws for HUF — callers must short-circuit before calling this", async () => {
    await expect(getExchangeRate("HUF", "2026-09-22")).rejects.toThrow(/HUF/);
    expect(mockGetCachedRate).not.toHaveBeenCalled();
  });

  it("returns the cached rate without touching MNB on an exact-date cache hit", async () => {
    mockGetCachedRate.mockResolvedValue({ currency: "EUR", rateDate: "2026-09-22", rate: 397.5 });

    const result = await getExchangeRate("EUR", "2026-09-22");

    expect(result).toEqual({ currency: "EUR", rate: 397.5, rateDate: "2026-09-22", source: "MNB" });
    expect(mockFetchMnb).not.toHaveBeenCalled();
  });

  it("fetches a lookup window from MNB on a cache miss and returns the exact date's rate", async () => {
    mockGetCachedRate.mockResolvedValue(null);
    mockFetchMnb.mockResolvedValue([
      { date: "2026-09-18", currency: "EUR", unit: 1, rate: 395.12 },
      { date: "2026-09-21", currency: "EUR", unit: 1, rate: 396.8 },
    ]);

    const result = await getExchangeRate("EUR", "2026-09-21");

    expect(result).toEqual({ currency: "EUR", rate: 396.8, rateDate: "2026-09-21", source: "MNB" });
    expect(mockFetchMnb).toHaveBeenCalledWith(
      { startDate: "2026-09-11", endDate: "2026-09-21", currencies: ["EUR"] },
      expect.any(Function)
    );
  });

  it("falls back to the latest earlier day when the exact date has no MNB quote (weekend/holiday)", async () => {
    mockGetCachedRate.mockResolvedValue(null);
    mockFetchMnb.mockResolvedValue([
      { date: "2026-09-18", currency: "EUR", unit: 1, rate: 395.12 },
    ]);

    // 2026-09-22 (a Tuesday, but treat as if unpublished in this fixture)
    const result = await getExchangeRate("EUR", "2026-09-20");

    expect(result).toEqual({ currency: "EUR", rate: 395.12, rateDate: "2026-09-18", source: "MNB" });
  });

  it("normalizes a per-100 currency (e.g. JPY) to a per-unit rate", async () => {
    mockGetCachedRate.mockResolvedValue(null);
    mockFetchMnb.mockResolvedValue([{ date: "2026-09-22", currency: "JPY", unit: 100, rate: 265.43 }]);

    const result = await getExchangeRate("JPY", "2026-09-22");

    expect(result?.rate).toBeCloseTo(2.6543, 4);
  });

  it("caches every fetched day, not just the picked one", async () => {
    mockGetCachedRate.mockResolvedValue(null);
    mockFetchMnb.mockResolvedValue([
      { date: "2026-09-18", currency: "EUR", unit: 1, rate: 395.12 },
      { date: "2026-09-21", currency: "EUR", unit: 1, rate: 396.8 },
    ]);

    await getExchangeRate("EUR", "2026-09-21");

    expect(mockSaveRates).toHaveBeenCalledWith([
      { currency: "EUR", rateDate: "2026-09-18", rate: 395.12 },
      { currency: "EUR", rateDate: "2026-09-21", rate: 396.8 },
    ]);
  });

  it("returns null (not an error) when MNB has nothing in the window — e.g. today, before publish time", async () => {
    mockGetCachedRate.mockResolvedValue(null);
    mockFetchMnb.mockResolvedValue([]);

    const result = await getExchangeRate("EUR", "2026-09-22");

    expect(result).toBeNull();
    expect(mockSaveRates).not.toHaveBeenCalled();
  });

  it("propagates MnbFetchError instead of swallowing it — caller decides the fallback", async () => {
    mockGetCachedRate.mockResolvedValue(null);
    mockFetchMnb.mockRejectedValue(new MnbFetchError("network down"));

    await expect(getExchangeRate("EUR", "2026-09-22")).rejects.toThrow(MnbFetchError);
    expect(mockSaveRates).not.toHaveBeenCalled();
  });
});
