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

function mockAuthResponse(token: string, validitySeconds = 300) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: () =>
      Promise.resolve(
        JSON.stringify({ token, tokenValiditySeconds: validitySeconds })
      ),
  });
}

describe("authenticate", () => {
  beforeEach(() => {
    clearAuthCache();
    mockFetch.mockReset();
  });

  it("sends credentials and returns a token", async () => {
    mockAuthResponse("tok-123");
    const result = await authenticate(testCredentials, "test");

    expect(result.token).toBe("tok-123");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/authenticate");
  });

  it("reuses cached token on second call", async () => {
    mockAuthResponse("tok-cached", 600);
    const first = await authenticate(testCredentials, "test");
    const second = await authenticate(testCredentials, "test");

    expect(second.token).toBe(first.token);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () =>
        Promise.resolve(
          JSON.stringify({ resultCode: "AUTH_FAILED", resultMessage: "Bad creds" })
        ),
    });

    await expect(authenticate(testCredentials, "test")).rejects.toThrow(
      /AUTH_FAILED/
    );
  });

  it("throws on non-JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(authenticate(testCredentials, "test")).rejects.toThrow(
      /500/
    );
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

    mockAuthResponse("tok-company-a");
    const tokenA = await authenticate(companyA, "test");

    mockAuthResponse("tok-company-b");
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
    mockAuthResponse("tok-1");
    await authenticate(testCredentials, "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    clearAuthCache();

    mockAuthResponse("tok-2");
    const result = await authenticate(testCredentials, "test");
    expect(result.token).toBe("tok-2");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
