// lib/payments/revolut.test.ts
import { createRevolutPaymentLink } from "@/lib/payments/revolut";

describe("createRevolutPaymentLink", () => {
  it("returns stub checkout URL", async () => {
    const result = await createRevolutPaymentLink({
      invoiceId: "inv-abc",
      amount: 100,
      currency: "EUR",
      description: "Test",
    });
    expect(result.provider).toBe("revolut");
    expect(result.url).toMatch(/^https?:\/\//);
    expect(result.externalId).toContain("inv-abc");
  });
});
