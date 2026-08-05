// lib/m2m/signature.test.ts
import { generateM2mSignature, m2mUtcTimestamp } from "@/lib/m2m/signature";

describe("generateM2mSignature", () => {
  it("formats UTC timestamp as yyyyMMddHHmmss", () => {
    expect(m2mUtcTimestamp(new Date("2026-07-07T14:30:00.000Z"))).toBe("20260707143000");
  });

  it("returns uppercase base64 sha256", () => {
    const signature = generateM2mSignature(
      "msg-id",
      "base",
      "signing-key",
      new Date("2026-01-01T00:00:00.000Z")
    );
    expect(signature).toMatch(/^[A-Z0-9+/=]+$/);
    expect(signature).toBe(
      generateM2mSignature("msg-id", "base", "signing-key", new Date("2026-01-01T00:00:00.000Z"))
    );
  });
});
