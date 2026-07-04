// lib/receipts/numbers.test.ts
import { generateReceiptNumber } from "@/lib/receipts/numbers";

describe("generateReceiptNumber", () => {
  it("starts at 001 for empty list", () => {
    const year = new Date().getFullYear();
    expect(generateReceiptNumber([])).toBe(`NYG-${year}-001`);
  });

  it("increments within the same year", () => {
    const year = new Date().getFullYear();
    expect(
      generateReceiptNumber([
        { receiptNumber: `NYG-${year}-001` },
        { receiptNumber: `NYG-${year}-002` },
      ])
    ).toBe(`NYG-${year}-003`);
  });
});
