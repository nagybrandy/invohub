// lib/nav-receipt/environment.test.ts
import { getReceiptBaseUrl, resolveReceiptEnvironment } from "@/lib/nav-receipt/environment";

describe("getReceiptBaseUrl", () => {
  it("returns test URL for test environment", () => {
    expect(getReceiptBaseUrl("test")).toBe(
      "https://api-test.onlineszamla.nav.gov.hu/receipt-if/v1"
    );
  });

  it("returns production URL for production environment", () => {
    expect(getReceiptBaseUrl("production")).toBe(
      "https://api.onlineszamla.nav.gov.hu/receipt-if/v1"
    );
  });
});

describe("resolveReceiptEnvironment", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("returns production when env var is production", () => {
    process.env.NAV_RECEIPT_ENV = "production";
    expect(resolveReceiptEnvironment()).toBe("production");
  });

  it("defaults to test for any other value", () => {
    process.env.NAV_RECEIPT_ENV = "staging";
    expect(resolveReceiptEnvironment()).toBe("test");
  });

  it("defaults to test when env var is unset", () => {
    delete process.env.NAV_RECEIPT_ENV;
    expect(resolveReceiptEnvironment()).toBe("test");
  });
});
