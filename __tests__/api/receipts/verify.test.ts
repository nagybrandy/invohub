// __tests__/api/receipts/verify.test.ts
jest.mock("@/lib/receipts/service", () => ({
  getPublicReceiptByToken: jest.fn(),
}));

import { GET } from "@/app/api/receipts/verify+api";
import { getPublicReceiptByToken } from "@/lib/receipts/service";
import { resetRateLimitsForTests } from "@/lib/api/rate-limit";

const mockVerify = getPublicReceiptByToken as jest.MockedFunction<
  typeof getPublicReceiptByToken
>;

function requestFrom(ip: string, token = "abc") {
  return new Request(`http://localhost/api/receipts/verify?token=${token}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("GET /api/receipts/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitsForTests();
  });

  it("requires token", async () => {
    const response = await GET(new Request("http://localhost/api/receipts/verify"));
    expect(response.status).toBe(400);
  });

  it("returns public receipt", async () => {
    mockVerify.mockResolvedValue({
      receiptNumber: "NYG-2026-001",
      clientName: "Walk-in",
      totalAmount: 1000,
      currency: "HUF",
      issuedAt: "2026-07-04T10:00:00.000Z",
      issuerName: "Demo Kft.",
      verified: true,
    });

    const response = await GET(
      new Request("http://localhost/api/receipts/verify?token=abc")
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.receipt.receiptNumber).toBe("NYG-2026-001");
  });

  it("returns 404 for unknown token", async () => {
    mockVerify.mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/receipts/verify?token=missing")
    );
    expect(response.status).toBe(404);
  });

  it("rate-limits repeated lookups from the same IP instead of allowing unbounded token enumeration", async () => {
    mockVerify.mockResolvedValue(null);
    const ip = "203.0.113.9";

    for (let i = 0; i < 20; i++) {
      const response = await GET(requestFrom(ip, `guess-${i}`));
      expect(response.status).not.toBe(429);
    }

    const limited = await GET(requestFrom(ip, "guess-20"));
    expect(limited.status).toBe(429);
    // The lookup itself must never even run once the caller is throttled.
    expect(mockVerify).toHaveBeenCalledTimes(20);
  });

  it("rate-limits per IP, not globally", async () => {
    mockVerify.mockResolvedValue(null);
    for (let i = 0; i < 20; i++) {
      await GET(requestFrom("203.0.113.9", `guess-${i}`));
    }
    const otherIp = await GET(requestFrom("198.51.100.4", "guess-x"));
    expect(otherIp.status).not.toBe(429);
  });
});
