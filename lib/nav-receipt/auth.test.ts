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
