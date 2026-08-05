// lib/receipts/calculations.test.ts
import { calculateLineItemTotals } from "@/lib/receipts/calculations";

describe("calculateLineItemTotals", () => {
  it("calculates single item with 27% VAT", () => {
    const result = calculateLineItemTotals([
      { description: "Coffee", quantity: 2, unitPrice: 1000, vatRate: 27 },
    ]);
    expect(result.netTotal).toBe(2000);
    expect(result.vatTotal).toBe(540);
    expect(result.grossTotal).toBe(2540);
    expect(result.vatBreakdown).toHaveLength(1);
    expect(result.vatBreakdown[0].vatRate).toBe(27);
    expect(result.vatBreakdown[0].itemCount).toBe(1);
  });

  it("aggregates items by VAT rate", () => {
    const result = calculateLineItemTotals([
      { description: "A", quantity: 1, unitPrice: 1000, vatRate: 27 },
      { description: "B", quantity: 1, unitPrice: 500, vatRate: 5 },
      { description: "C", quantity: 1, unitPrice: 200, vatRate: 27 },
    ]);
    expect(result.vatBreakdown).toHaveLength(2);

    const vat27 = result.vatBreakdown.find((v) => v.vatRate === 27)!;
    expect(vat27.netAmount).toBe(1200);
    expect(vat27.vatAmount).toBe(324);
    expect(vat27.grossAmount).toBe(1524);
    expect(vat27.itemCount).toBe(2);

    const vat5 = result.vatBreakdown.find((v) => v.vatRate === 5)!;
    expect(vat5.netAmount).toBe(500);
    expect(vat5.vatAmount).toBe(25);
    expect(vat5.grossAmount).toBe(525);
    expect(vat5.itemCount).toBe(1);

    expect(result.grossTotal).toBe(1524 + 525);
  });

  it("handles zero VAT rate", () => {
    const result = calculateLineItemTotals([
      { description: "Exempt item", quantity: 3, unitPrice: 1000, vatRate: 0 },
    ]);
    expect(result.netTotal).toBe(3000);
    expect(result.vatTotal).toBe(0);
    expect(result.grossTotal).toBe(3000);
  });

  it("handles 18% VAT rate", () => {
    const result = calculateLineItemTotals([
      { description: "Dairy", quantity: 1, unitPrice: 400, vatRate: 18 },
    ]);
    expect(result.vatTotal).toBe(72);
    expect(result.grossTotal).toBe(472);
  });

  it("returns empty breakdown for empty items", () => {
    const result = calculateLineItemTotals([]);
    expect(result.netTotal).toBe(0);
    expect(result.vatTotal).toBe(0);
    expect(result.grossTotal).toBe(0);
    expect(result.vatBreakdown).toHaveLength(0);
  });

  it("handles fractional quantities", () => {
    const result = calculateLineItemTotals([
      { description: "Kilos", quantity: 1.5, unitPrice: 2000, vatRate: 27 },
    ]);
    expect(result.netTotal).toBe(3000);
    expect(result.vatTotal).toBe(810);
    expect(result.grossTotal).toBe(3810);
  });
});
