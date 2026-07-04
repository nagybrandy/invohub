// __tests__/api/receipts/verify.test.ts
jest.mock("@/lib/receipts/service", () => ({
  getPublicReceiptByToken: jest.fn(),
}));

import { GET } from "@/app/api/receipts/verify+api";
import { getPublicReceiptByToken } from "@/lib/receipts/service";

const mockVerify = getPublicReceiptByToken as jest.MockedFunction<
  typeof getPublicReceiptByToken
>;

describe("GET /api/receipts/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
