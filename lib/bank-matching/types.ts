// lib/bank-matching/types.ts
// Pure bank↔invoice matching domain types (no provider wiring).

export type BankTransaction = {
  id: string;
  /** Signed amount in major currency units; credits (incoming) are positive. */
  amount: number;
  currency: "HUF" | "EUR";
  bookedAt: string;
  counterpartyName: string;
  remittanceInfo?: string;
};

export type MatchableInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  /** Gross total in major currency units. */
  totalAmount: number;
  currency: "HUF" | "EUR";
  issueDate: string;
  dueDate: string;
  status: "sent" | "overdue";
};

export type MatchConfidence = "exact" | "high" | "medium" | "low";

export type MatchReason =
  | "invoice_number_in_remittance"
  | "amount_equal"
  | "amount_near"
  | "counterparty_exact"
  | "counterparty_similar"
  | "date_in_window";

export type MatchCandidate = {
  transactionId: string;
  invoiceId: string;
  confidence: MatchConfidence;
  score: number;
  reasons: MatchReason[];
  /** Only exact confidence may auto-finalize; uncertain matches stay in review. */
  autoFinalize: boolean;
};
