// lib/payments/barion.test.ts
import { createBarionPaymentLink } from "@/lib/payments/barion";

describe("createBarionPaymentLink", () => {
  it("returns stub checkout URL", async () => {
    const result = await createBarionPaymentLink({
      invoiceId: "inv-xyz",
      amount: 5000,
      currency: "HUF",
      description: "Test",
    });
    expect(result.provider).toBe("barion");
    expect(result.url).toContain("barion");
    expect(result.externalId).toContain("inv-xyz");
  });
});
