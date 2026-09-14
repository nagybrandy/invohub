// lib/bank-matching/index.ts
// Bank matching Phase B entry: pure candidate scoring before provider wiring.
export type {
  BankTransaction,
  MatchCandidate,
  MatchConfidence,
  MatchReason,
  MatchableInvoice,
} from "@/lib/bank-matching/types";
export {
  compactRemittance,
  normalizeInvoiceNumber,
  normalizePartyName,
  normalizeRemittance,
  stripDiacritics,
} from "@/lib/bank-matching/normalize";
export {
  findMatchCandidates,
  reviewQueue,
  scoreTransactionAgainstInvoice,
} from "@/lib/bank-matching/score";
