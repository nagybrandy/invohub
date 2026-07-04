// lib/receipts/qr-payload.test.ts
import { buildReceiptQrPayload, buildReceiptQrUrl } from "@/lib/receipts/qr-payload";

jest.mock("@/lib/auth-url", () => ({
  getClientAuthBaseURL: () => "http://localhost:8081",
}));

describe("buildReceiptQrUrl", () => {
  it("builds encoded public URL", () => {
    expect(buildReceiptQrUrl("token/with+space")).toBe(
      "http://localhost:8081/receipts/view?token=token%2Fwith%2Bspace"
    );
  });
});

describe("buildReceiptQrPayload", () => {
  it("matches QR URL", () => {
    expect(buildReceiptQrPayload("abc123")).toBe(buildReceiptQrUrl("abc123"));
  });
});
