// lib/nav-receipt/auth.test.ts
import { authenticate, clearAuthCache } from "@/lib/nav-receipt/auth";
import type { NavReceiptCredentials } from "@/lib/nav-receipt/types";

const testCredentials: NavReceiptCredentials = {
  technicalUser: "testuser",
  technicalPassword: "testpass",
  signingKey: "signkey123",
  taxNumber: "12345678",
};

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockAuthXmlResponse(token: string, validTo = new Date(Date.now() + 3_600_000).toISOString()) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        `<AuthTokenResponse><resultCode>OK</resultCode><token>${token}</token><validTo>${validTo}</validTo></AuthTokenResponse>`
      ),
  });
}

describe("authenticate", () => {
  beforeEach(() => {
    clearAuthCache();
    mockFetch.mockReset();
  });

  it("posts the auth XML to <base>/auth/token with Content-Type: application/xml", async () => {
    mockAuthXmlResponse("tok-123");
    const result = await authenticate(testCredentials, "test");

    expect(result.token).toBe("tok-123");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://bv-receipt-if.enyugta.nav.gov.hu/v1/auth/token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/xml");
    expect(typeof init.body).toBe("string");
    expect(init.body).toContain("<AuthTokenRequest");
  });

  it("expires the cache entry from validTo", async () => {
    const soonValidTo = new Date(Date.now() + 5_000).toISOString(); // < 30s cache margin
    mockAuthXmlResponse("tok-soon", soonValidTo);
    await authenticate(testCredentials, "test");

    mockAuthXmlResponse("tok-next");
    const second = await authenticate(testCredentials, "test");

    expect(second.token).toBe("tok-next");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("reuses a cached token while validTo is still far enough in the future", async () => {
    mockAuthXmlResponse("tok-cached");
    const first = await authenticate(testCredentials, "test");
    const second = await authenticate(testCredentials, "test");

    expect(second.token).toBe(first.token);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects with NAV's resultCode + message on an error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () =>
        Promise.resolve(
          "<GeneralExceptionResponse><resultCode>AUTH_FAILED</resultCode><message>Bad creds</message></GeneralExceptionResponse>"
        ),
    });

    await expect(authenticate(testCredentials, "test")).rejects.toThrow(/AUTH_FAILED.*Bad creds/s);
  });

  it("rejects with the HTTP status plus a truncated body when the body is not parseable XML", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(authenticate(testCredentials, "test")).rejects.toThrow(/500.*Internal Server Error/s);
  });

  it("makes no call at all in demo mode", async () => {
    await expect(authenticate(testCredentials, "demo")).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not reuse a token cached for a different company's credentials", async () => {
    // Reproduces the cron path: app/api/cron/nav-receipt-report+api.ts
    // authenticates once per company, in a loop, within one process.
    const companyA: NavReceiptCredentials = {
      technicalUser: "user-a",
      technicalPassword: "pass-a",
      signingKey: "sign-a",
      taxNumber: "11111111",
    };
    const companyB: NavReceiptCredentials = {
      technicalUser: "user-b",
      technicalPassword: "pass-b",
      signingKey: "sign-b",
      taxNumber: "22222222",
    };

    mockAuthXmlResponse("tok-company-a");
    const tokenA = await authenticate(companyA, "test");

    mockAuthXmlResponse("tok-company-b");
    const tokenB = await authenticate(companyB, "test");

    expect(tokenA.token).toBe("tok-company-a");
    expect(tokenB.token).toBe("tok-company-b");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // And a third call for companyA again should hit its own cached token,
    // not re-fetch and not somehow return companyB's.
    const tokenAAgain = await authenticate(companyA, "test");
    expect(tokenAAgain.token).toBe("tok-company-a");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("clears cache via clearAuthCache", async () => {
    mockAuthXmlResponse("tok-1");
    await authenticate(testCredentials, "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    clearAuthCache();

    mockAuthXmlResponse("tok-2");
    const result = await authenticate(testCredentials, "test");
    expect(result.token).toBe("tok-2");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
