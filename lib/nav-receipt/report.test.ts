// lib/nav-receipt/report.test.ts
import {
  submitDailyReceiptReport,
  registerReceiptSoftware,
} from "@/lib/nav-receipt/report";
import { clearAuthCache } from "@/lib/nav-receipt/auth";
import type {
  DailyReceiptReport,
  NavReceiptCredentials,
} from "@/lib/nav-receipt/types";

const testCredentials: NavReceiptCredentials = {
  technicalUser: "testuser",
  technicalPassword: "testpass",
  signingKey: "signkey123",
  taxNumber: "12345678",
};

const testReport: DailyReceiptReport = {
  taxNumber: "12345678",
  softwareId: "SW-001",
  reportDate: "2026-09-01",
  startReceiptNumber: "R-0001",
  endReceiptNumber: "R-0050",
  receiptCount: 50,
  cancelledCount: 2,
  vatAggregations: [
    {
      vatRate: 27,
      vatRateCode: "27",
      netAmount: 100000,
      vatAmount: 27000,
      grossAmount: 127000,
      receiptCount: 40,
    },
  ],
};

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockAuthSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(JSON.stringify({ token: "test-token", tokenValiditySeconds: 600 })),
  });
}

describe("submitDailyReceiptReport", () => {
  beforeEach(() => {
    clearAuthCache();
    mockFetch.mockReset();
  });

  it("submits report and returns ok on success", async () => {
    mockAuthSuccess();
    mockFetch.mockResolvedValueOnce({
      status: 200,
      text: () =>
        Promise.resolve("<result><transactionId>TX-42</transactionId></result>"),
    });

    const result = await submitDailyReceiptReport(testReport, testCredentials, "test");
    expect(result.ok).toBe(true);
    expect(result.transactionId).toBe("TX-42");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns error on HTTP failure", async () => {
    mockAuthSuccess();
    mockFetch.mockResolvedValueOnce({
      status: 400,
      text: () =>
        Promise.resolve("<error><message>Bad data</message></error>"),
    });

    const result = await submitDailyReceiptReport(testReport, testCredentials, "test");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Bad data");
  });
});

describe("registerReceiptSoftware", () => {
  beforeEach(() => {
    clearAuthCache();
    mockFetch.mockReset();
  });

  it("registers software and returns softwareId", async () => {
    mockAuthSuccess();
    mockFetch.mockResolvedValueOnce({
      status: 200,
      text: () =>
        Promise.resolve("<result><softwareId>SW-NEW-1</softwareId></result>"),
    });

    const result = await registerReceiptSoftware(testCredentials, "test", "MyApp");
    expect(result.ok).toBe(true);
    expect(result.softwareId).toBe("SW-NEW-1");
  });

  it("returns error on failure", async () => {
    mockAuthSuccess();
    mockFetch.mockResolvedValueOnce({
      status: 500,
      text: () =>
        Promise.resolve("<error><resultMessage>Server error</resultMessage></error>"),
    });

    const result = await registerReceiptSoftware(testCredentials, "test");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Server error");
  });
});
