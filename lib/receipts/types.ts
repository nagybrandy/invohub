// lib/receipts/types.ts
// Shared receipt types for API responses and UI.
export type ReceiptCurrency = "EUR" | "HUF";

export type PublicReceiptView = {
  receiptNumber: string;
  clientName: string | null;
  totalAmount: number;
  currency: ReceiptCurrency;
  issuedAt: string;
  issuerName: string;
  verified: true;
};
