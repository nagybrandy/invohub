// lib/invoices/mark-paid-input.test.ts
import { parseMarkPaidInput } from "@/lib/invoices/mark-paid-input";

describe("parseMarkPaidInput", () => {
  it("accepts an empty body", () => {
    const result = parseMarkPaidInput({});
    expect(result).toEqual({
      ok: true,
      input: { paymentMethod: undefined, paidAt: undefined, paidAmount: undefined },
    });
  });

  it("passes through a valid paymentMethod/paidAt/paidAmount", () => {
    const result = parseMarkPaidInput({
      paymentMethod: "transfer",
      paidAt: "2026-01-01T00:00:00.000Z",
      paidAmount: 500,
    });
    expect(result).toEqual({
      ok: true,
      input: { paymentMethod: "transfer", paidAt: "2026-01-01T00:00:00.000Z", paidAmount: 500 },
    });
  });

  it("rejects an unknown paymentMethod", () => {
    const result = parseMarkPaidInput({ paymentMethod: "bitcoin" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("paymentMethod");
  });

  it("rejects a negative paidAmount", () => {
    const result = parseMarkPaidInput({ paidAmount: -5 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error).toContain("paidAmount");
  });

  it("rejects a non-numeric paidAmount", () => {
    const result = parseMarkPaidInput({ paidAmount: "500" });
    expect(result.ok).toBe(false);
  });
});
