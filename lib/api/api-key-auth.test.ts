// lib/api/api-key-auth.test.ts
jest.mock("@/lib/api-keys/service", () => ({
  authenticateApiKey: jest.fn(),
}));

import { authenticateApiKey } from "@/lib/api-keys/service";
import { requireApiKey, requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { resetRateLimitsForTests } from "@/lib/api/rate-limit";

const mockAuth = authenticateApiKey as jest.MockedFunction<typeof authenticateApiKey>;

describe("requireApiKey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects missing credentials", async () => {
    const result = await requireApiKey(new Request("http://localhost/api/v1/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("accepts valid bearer credentials", async () => {
    mockAuth.mockResolvedValue({
      id: "k1",
      userId: "user-1",
      name: "Test",
      publicKey: "ih_pk_abc",
      enabled: true,
      lastUsedAt: null,
      createdAt: "",
      updatedAt: "",
    });

    const result = await requireApiKey(
      new Request("http://localhost/api/v1/invoices", {
        headers: { Authorization: "Bearer ih_pk_abc:ih_sk_xyz" },
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("user-1");
    }
  });

  it("rejects invalid secret", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireApiKey(
      new Request("http://localhost/api/v1/invoices", {
        headers: { Authorization: "Bearer ih_pk_abc:ih_sk_bad" },
      })
    );
    expect(result.ok).toBe(false);
  });
});

describe("requireApiKeyForV1", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitsForTests();
  });

  function validRequest() {
    return new Request("http://localhost/api/v1/invoices", {
      headers: { Authorization: "Bearer ih_pk_abc:ih_sk_xyz" },
    });
  }

  it("rejects missing credentials same as requireApiKey", async () => {
    const result = await requireApiKeyForV1(new Request("http://localhost/api/v1/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("accepts valid credentials under the rate limit", async () => {
    mockAuth.mockResolvedValue({
      id: "k1",
      userId: "user-1",
      name: "Test",
      publicKey: "ih_pk_abc",
      enabled: true,
      lastUsedAt: null,
      createdAt: "",
      updatedAt: "",
    });

    const result = await requireApiKeyForV1(validRequest());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe("user-1");
  });

  it("returns 429 with Retry-After once the per-key rate limit is exceeded", async () => {
    mockAuth.mockResolvedValue({
      id: "k1",
      userId: "user-1",
      name: "Test",
      publicKey: "ih_pk_abc",
      enabled: true,
      lastUsedAt: null,
      createdAt: "",
      updatedAt: "",
    });

    let last: Awaited<ReturnType<typeof requireApiKeyForV1>> | null = null;
    for (let i = 0; i < 200; i++) {
      last = await requireApiKeyForV1(validRequest());
    }

    expect(last?.ok).toBe(false);
    if (last && !last.ok) {
      expect(last.response.status).toBe(429);
      expect(last.response.headers.get("Retry-After")).toBeTruthy();
      const body = await last.response.json();
      expect(body.code).toBe("rateLimited");
    }
  });

  it("keeps separate rate-limit buckets per API key id", async () => {
    mockAuth.mockResolvedValue({
      id: "k1",
      userId: "user-1",
      name: "Test",
      publicKey: "ih_pk_abc",
      enabled: true,
      lastUsedAt: null,
      createdAt: "",
      updatedAt: "",
    });
    for (let i = 0; i < 200; i++) {
      await requireApiKeyForV1(validRequest());
    }

    mockAuth.mockResolvedValueOnce({
      id: "k2",
      userId: "user-2",
      name: "Test 2",
      publicKey: "ih_pk_def",
      enabled: true,
      lastUsedAt: null,
      createdAt: "",
      updatedAt: "",
    });
    const otherKey = await requireApiKeyForV1(
      new Request("http://localhost/api/v1/invoices", {
        headers: { Authorization: "Bearer ih_pk_def:ih_sk_xyz" },
      })
    );
    expect(otherKey.ok).toBe(true);
  });
});
