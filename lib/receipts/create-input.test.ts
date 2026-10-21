import { withoutClientReceiptNumber } from "@/lib/receipts/create-input";

describe("withoutClientReceiptNumber", () => {
  it("drops a caller-chosen receipt number and keeps everything else", () => {
    const out = withoutClientReceiptNumber({
      receiptNumber: "NYG-2026-999",
      currency: "HUF",
      paymentMethod: "cash",
      lineItems: [{ description: "Kávé", quantity: 1, unitPrice: 500, vatRate: 27 }],
    });
    expect(out).not.toHaveProperty("receiptNumber");
    expect(out.currency).toBe("HUF");
    expect(out.lineItems).toHaveLength(1);
  });

  it("is a no-op when no number was sent", () => {
    expect(withoutClientReceiptNumber({ currency: "EUR" })).toEqual({ currency: "EUR" });
  });
});
