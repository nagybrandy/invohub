// lib/payments/types.ts
// Payment provider adapter types.
export type PaymentProvider = "revolut" | "barion" | "manual";

export type PaymentLinkRequest = {
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
};

export type PaymentLinkResult = {
  provider: PaymentProvider;
  url: string;
  externalId: string;
};
