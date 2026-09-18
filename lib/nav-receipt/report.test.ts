// lib/nav-receipt/report.test.ts
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import { clearAuthCache } from "@/lib/nav-receipt/auth";
import type { DailyReceiptReport, NavReceiptCredentials } from "@/lib/nav-receipt/types";

const testCredentials: NavReceiptCredentials = {
  technicalUser: "testuser",
  technicalPassword: "testpass",
  signingKey: "signkey123",
  taxNumber: "12345678",
};

const testReport: DailyReceiptReport = {
  taxPayerId: "12345678",
  issuingSoftwareName: "InvoHub",
  applicableDate: "2026-07-12",
  serialNumber: "NYG-2026-001",
  currency: "HUF",
  exchangeRate: null,
  vatCategoryItems: [{ vat: "27%", saleDocument: 127000, modifyingDocument: 0 }],
  total: 127000,
  numberOfSaleDocument: 40,
  numberOfModifyingDocument: 0,
};

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockAuthSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        `<AuthTokenResponse><token>test-token</token><validTo>${new Date(
          Date.now() + 3_600_000
        ).toISOString()}</validTo></AuthTokenResponse>`
      ),
  });
}

describe("submitReceiptDataReport", () => {
  beforeEach(() => {
    clearAuthCache();
    mockFetch.mockReset();
  });

  it("posts to <base>/receipt/create with Authorization: Bearer <token> and returns the parsed id", async () => {
    mockAuthSuccess();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          "<CreateReceiptResponse><resultCode>OK</resultCode><id>12345678_20260712_3</id></CreateReceiptResponse>"
        ),
    });

    const result = await submitReceiptDataReport(testReport, testCredentials, "test");

    expect(result).toEqual({ ok: true, reportId: "12345678_20260712_3" });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe("https://bv-receipt-if.enyugta.nav.gov.hu/v1/receipt/create");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("returns { ok: false, error } containing NAV's message on a NAV error, with no retry", async () => {
    mockAuthSuccess();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          "<GeneralExceptionResponse><resultCode>VALIDATION_ERROR</resultCode><message>Bad data</message></GeneralExceptionResponse>"
        ),
    });

    const result = await submitReceiptDataReport(testReport, testCredentials, "test");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Bad data");
    // auth + one create call — no retry of the failed create call.
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
