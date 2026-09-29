// lib/invoices/exchange-rate-autofill.test.ts
jest.mock("@/lib/exchange-rates/service", () => ({
  getExchangeRate: jest.fn(),
}));

import { getExchangeRate } from "@/lib/exchange-rates/service";
import { autofillMissingExchangeRate } from "@/lib/invoices/exchange-rate-autofill";

const mockGetExchangeRate = getExchangeRate as jest.MockedFunction<typeof getExchangeRate>;

describe("autofillMissingExchangeRate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns undefined for HUF without ever calling MNB", async () => {
    const result = await autofillMissingExchangeRate({ currency: "HUF", issueDate: "2026-09-22" });
    expect(result).toBeUndefined();
    expect(mockGetExchangeRate).not.toHaveBeenCalled();
  });

  it("keeps the caller's own valid rate unchanged, without calling MNB", async () => {
    const result = await autofillMissingExchangeRate({
      currency: "EUR",
      exchangeRate: 390.5,
      issueDate: "2026-09-22",
    });
    expect(result).toBe(390.5);
    expect(mockGetExchangeRate).not.toHaveBeenCalled();
  });

  it("fetches from MNB when the rate is missing on a non-HUF invoice", async () => {
    mockGetExchangeRate.mockResolvedValue({
      currency: "EUR",
      rate: 397.5,
      rateDate: "2026-09-22",
      source: "MNB",
    });

    const result = await autofillMissingExchangeRate({ currency: "EUR", issueDate: "2026-09-22" });

    expect(result).toBe(397.5);
    expect(mockGetExchangeRate).toHaveBeenCalledWith("EUR", "2026-09-22");
  });

  it("treats a non-positive or non-numeric rate as missing and fetches", async () => {
    mockGetExchangeRate.mockResolvedValue({
      currency: "EUR",
      rate: 397.5,
      rateDate: "2026-09-22",
      source: "MNB",
    });

    const result = await autofillMissingExchangeRate({
      currency: "EUR",
      exchangeRate: 0,
      issueDate: "2026-09-22",
    });

    expect(result).toBe(397.5);
  });

  it("prefers the fulfillment date over the issue date (Áfa tv. 80. §)", async () => {
    mockGetExchangeRate.mockResolvedValue({
      currency: "EUR",
      rate: 396.8,
      rateDate: "2026-09-20",
      source: "MNB",
    });

    await autofillMissingExchangeRate({
      currency: "EUR",
      issueDate: "2026-09-22",
      fulfillmentDate: "2026-09-20",
    });

    expect(mockGetExchangeRate).toHaveBeenCalledWith("EUR", "2026-09-20");
  });

  it("falls back to the issue date when fulfillment date is absent", async () => {
    mockGetExchangeRate.mockResolvedValue(null);
    await autofillMissingExchangeRate({ currency: "EUR", issueDate: "2026-09-22" });
    expect(mockGetExchangeRate).toHaveBeenCalledWith("EUR", "2026-09-22");
  });

  it("returns undefined when MNB has no rate for the window (no throw)", async () => {
    mockGetExchangeRate.mockResolvedValue(null);
    const result = await autofillMissingExchangeRate({ currency: "EUR", issueDate: "2026-09-22" });
    expect(result).toBeUndefined();
  });

  it("returns undefined (not a throw) when MNB is unreachable — leaves the missing-rate banner as fallback", async () => {
    mockGetExchangeRate.mockRejectedValue(new Error("network down"));
    const result = await autofillMissingExchangeRate({ currency: "EUR", issueDate: "2026-09-22" });
    expect(result).toBeUndefined();
  });
});
