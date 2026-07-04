// lib/api/api-key-auth.test.ts
jest.mock("@/lib/api-keys/service", () => ({
  authenticateApiKey: jest.fn(),
}));

import { authenticateApiKey } from "@/lib/api-keys/service";
import { requireApiKey } from "@/lib/api/api-key-auth";

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
