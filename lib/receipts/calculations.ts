// lib/receipts/calculations.ts
export type ReceiptLineItemCalcInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  unit?: string;
};

export type VatBreakdownEntry = {
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  itemCount: number;
};

export function calculateLineItemTotals(items: ReceiptLineItemCalcInput[]) {
  let netTotal = 0;
  let vatTotal = 0;
  const byRate = new Map<number, VatBreakdownEntry>();

  for (const item of items) {
    const net = item.quantity * item.unitPrice;
    const vat = net * (item.vatRate / 100);
    netTotal += net;
    vatTotal += vat;

    const existing = byRate.get(item.vatRate);
    if (existing) {
      existing.netAmount += net;
      existing.vatAmount += vat;
      existing.grossAmount += net + vat;
      existing.itemCount += 1;
    } else {
      byRate.set(item.vatRate, {
        vatRate: item.vatRate,
        netAmount: net,
        vatAmount: vat,
        grossAmount: net + vat,
        itemCount: 1,
      });
    }
  }

  return {
    netTotal,
    vatTotal,
    grossTotal: netTotal + vatTotal,
    vatBreakdown: Array.from(byRate.values()),
  };
}
