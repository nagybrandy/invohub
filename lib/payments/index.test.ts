// lib/payments/index.test.ts
import { createPaymentLink } from "@/lib/payments/index";

describe("createPaymentLink", () => {
  const request = {
    invoiceId: "inv-1",
    amount: 127,
    currency: "EUR",
    description: "Invoice INV-001",
  };

  it("creates Revolut stub link", async () => {
    const link = await createPaymentLink("revolut", request);
    expect(link.provider).toBe("revolut");
    expect(link.url).toContain("revolut");
    expect(link.externalId).toContain("inv-1");
  });

  it("creates Barion stub link", async () => {
    const link = await createPaymentLink("barion", request);
    expect(link.provider).toBe("barion");
    expect(link.url).toContain("barion");
  });

  it("returns empty URL for manual provider", async () => {
    const link = await createPaymentLink("manual", request);
    expect(link.provider).toBe("manual");
    expect(link.url).toBe("");
    expect(link.externalId).toBe("manual-inv-1");
  });
});
