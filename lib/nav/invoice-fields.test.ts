// lib/nav/invoice-fields.test.ts
import { toNavDate, toNavPaymentMethod } from "@/lib/nav/invoice-fields";
import { PAYMENT_METHODS } from "@/lib/invoices/payment-status";

describe("toNavPaymentMethod", () => {
  const expected: Record<(typeof PAYMENT_METHODS)[number], string> = {
    transfer: "TRANSFER",
    cash: "CASH",
    card: "CARD",
    other: "OTHER",
  };

  it.each(PAYMENT_METHODS)("maps InvoHub %s to its NAV enum value", (method) => {
    expect(toNavPaymentMethod(method)).toBe(expected[method]);
  });

  it("returns null for undefined/null/empty/whitespace-only input (caller omits the element)", () => {
    expect(toNavPaymentMethod(undefined)).toBeNull();
    expect(toNavPaymentMethod(null)).toBeNull();
    expect(toNavPaymentMethod("")).toBeNull();
    expect(toNavPaymentMethod("   ")).toBeNull();
  });

  it("maps any unrecognized non-empty value to OTHER, never a literal outside the enum", () => {
    expect(toNavPaymentMethod("bitcoin")).toBe("OTHER");
  });
});

describe("toNavDate", () => {
  it("passes through a plain date-only string", () => {
    expect(toNavDate("2026-06-15")).toBe("2026-06-15");
  });

  it("normalizes an ISO timestamp to its date part", () => {
    expect(toNavDate("2026-06-15T10:00:00.000Z")).toBe("2026-06-15");
  });

  it("returns null for empty, unparseable, or out-of-range input", () => {
    expect(toNavDate("")).toBeNull();
    expect(toNavDate("tomorrow")).toBeNull();
    expect(toNavDate("2026-13-01")).toBeNull(); // not a real month
    expect(toNavDate("2009-12-31")).toBeNull(); // below XSD minInclusive 2010-01-01
  });
});
