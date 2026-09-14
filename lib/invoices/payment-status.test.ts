// lib/invoices/payment-status.test.ts
import {
  deriveInvoiceStatusFromPayment,
  parsePaymentMethodFromNotes,
  resolvePaymentMethod,
} from "@/lib/invoices/payment-status";

describe("parsePaymentMethodFromNotes", () => {
  it("parses a transfer line", () => {
    expect(parsePaymentMethodFromNotes("Teljesítés: 2026-06-01\nFizetés: Átutalás")).toBe(
      "transfer"
    );
  });

  it("parses cash and card", () => {
    expect(parsePaymentMethodFromNotes("Fizetés: Készpénz")).toBe("cash");
    expect(parsePaymentMethodFromNotes("Fizetés: Bankkártya")).toBe("card");
  });

  it("returns undefined when there's no Fizetés line", () => {
    expect(parsePaymentMethodFromNotes("Thank you for your business")).toBeUndefined();
  });

  it("returns undefined for empty/missing notes", () => {
    expect(parsePaymentMethodFromNotes(undefined)).toBeUndefined();
    expect(parsePaymentMethodFromNotes(null)).toBeUndefined();
    expect(parsePaymentMethodFromNotes("")).toBeUndefined();
  });
});

describe("resolvePaymentMethod", () => {
  it("prefers the real column over notes", () => {
    expect(resolvePaymentMethod("card", "Fizetés: Átutalás")).toBe("card");
  });

  it("falls back to legacy notes parsing when the column is empty", () => {
    expect(resolvePaymentMethod(null, "Fizetés: Átutalás")).toBe("transfer");
    expect(resolvePaymentMethod(undefined, "Fizetés: Készpénz")).toBe("cash");
  });

  it("is undefined when neither source has a method", () => {
    expect(resolvePaymentMethod(null, "Thank you")).toBeUndefined();
  });
});

describe("deriveInvoiceStatusFromPayment", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  it("returns paid when paidAmount covers the total", () => {
    expect(deriveInvoiceStatusFromPayment(1000, 1000, "2026-06-30", now)).toBe("paid");
    expect(deriveInvoiceStatusFromPayment(1000, 1000.005, "2026-06-30", now)).toBe("paid");
  });

  it("returns partially_paid for a partial amount", () => {
    expect(deriveInvoiceStatusFromPayment(1000, 400, "2026-06-30", now)).toBe(
      "partially_paid"
    );
  });

  it("returns unpaid when nothing is paid and not yet due", () => {
    expect(deriveInvoiceStatusFromPayment(1000, 0, "2026-06-30", now)).toBe("unpaid");
  });

  it("returns overdue when nothing is paid and the due date has passed", () => {
    expect(deriveInvoiceStatusFromPayment(1000, 0, "2026-06-01", now)).toBe("overdue");
  });
});
