// lib/nav-receipt/types.ts
export type NavReceiptEnvironment = "test" | "production";

export type NavReceiptCredentials = {
  technicalUser: string;
  technicalPassword: string;
  signingKey: string;
  taxNumber: string;
};

export type NavReceiptAuthToken = {
  token: string;
  expiresAt: Date;
};

export type VatRateAggregation = {
  vatRate: number;
  vatRateCode: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  receiptCount: number;
};

export type DailyReceiptReport = {
  taxNumber: string;
  softwareId: string;
  reportDate: string;
  startReceiptNumber: string;
  endReceiptNumber: string;
  receiptCount: number;
  cancelledCount: number;
  vatAggregations: VatRateAggregation[];
};

export type NavReceiptSubmissionResult = {
  ok: boolean;
  transactionId?: string;
  error?: string;
};

export type SoftwareRegistrationResult = {
  ok: boolean;
  softwareId?: string;
  error?: string;
};
