// lib/receipts/types.ts
export type ReceiptCurrency = "EUR" | "HUF";

export type ReceiptPaymentMethod = "cash" | "card" | "transfer" | "voucher";

export const RECEIPT_PAYMENT_METHODS: ReceiptPaymentMethod[] = [
  "cash",
  "card",
  "transfer",
  "voucher",
];

export const HU_VAT_RATES = [27, 18, 5, 0] as const;
export type HuVatRate = (typeof HU_VAT_RATES)[number];

export type PublicReceiptView = {
  receiptNumber: string;
  clientName: string | null;
  totalAmount: number;
  currency: ReceiptCurrency;
  issuedAt: string;
  issuerName: string;
  verified: true;
};
