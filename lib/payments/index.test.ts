// lib/payments/index.test.ts
import { createPaymentLink, PaymentProviderUnavailableError } from "@/lib/payments/index";

describe("createPaymentLink", () => {
  const request = {
    invoiceId: "inv-1",
    amount: 127,
    currency: "EUR",
    description: "Invoice INV-001",
  };

  it("rejects revolut — the adapter is a stub, not a real integration", async () => {
    await expect(createPaymentLink("revolut", request)).rejects.toThrow(
      PaymentProviderUnavailableError
    );
  });

  it("rejects barion — the adapter is a stub, not a real integration", async () => {
    await expect(createPaymentLink("barion", request)).rejects.toThrow(
      PaymentProviderUnavailableError
    );
  });

  it("returns empty URL for manual provider", async () => {
    const link = await createPaymentLink("manual", request);
    expect(link.provider).toBe("manual");
    expect(link.url).toBe("");
    expect(link.externalId).toBe("manual-inv-1");
  });
});
