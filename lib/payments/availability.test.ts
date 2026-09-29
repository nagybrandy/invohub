// lib/payments/availability.test.ts
import {
  filterAvailablePaymentProviders,
  isPaymentProviderAvailable,
} from "@/lib/payments/availability";

describe("isPaymentProviderAvailable", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("manual is always available (it never claims a link exists)", () => {
    expect(isPaymentProviderAvailable("manual")).toBe(true);
  });

  it("revolut is unavailable — the adapter is a stub, not a real API call", () => {
    expect(isPaymentProviderAvailable("revolut")).toBe(false);
  });

  it("barion is unavailable — the adapter is a stub, not a real API call", () => {
    expect(isPaymentProviderAvailable("barion")).toBe(false);
  });

  it("stays unavailable even when credentials are configured, since there is no real implementation yet", () => {
    process.env.REVOLUT_API_KEY = "test-key";
    process.env.BARION_POS_KEY = "test-key";
    expect(isPaymentProviderAvailable("revolut")).toBe(false);
    expect(isPaymentProviderAvailable("barion")).toBe(false);
  });
});

describe("filterAvailablePaymentProviders", () => {
  it("keeps only available providers", () => {
    expect(filterAvailablePaymentProviders(["revolut", "barion", "manual"])).toEqual([
      "manual",
    ]);
  });
});
