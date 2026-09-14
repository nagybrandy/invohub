// lib/bank-matching/score.ts
// Deterministic invoice↔transaction scoring; never auto-finalize uncertain matches.
import {
  compactRemittance,
  normalizeInvoiceNumber,
  normalizePartyName,
} from "@/lib/bank-matching/normalize";
import type {
  BankTransaction,
  MatchCandidate,
  MatchConfidence,
  MatchableInvoice,
  MatchReason,
} from "@/lib/bank-matching/types";

const AMOUNT_EPSILON_HUF = 1;
const AMOUNT_EPSILON_EUR = 0.01;
const DATE_GRACE_DAYS = 14;

function amountEpsilon(currency: BankTransaction["currency"]): number {
  return currency === "HUF" ? AMOUNT_EPSILON_HUF : AMOUNT_EPSILON_EUR;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isDateInWindow(invoice: MatchableInvoice, bookedAt: string): boolean {
  const from = invoice.issueDate;
  const toDate = new Date(invoice.dueDate);
  toDate.setUTCDate(toDate.getUTCDate() + DATE_GRACE_DAYS);
  const to = toDate.toISOString().slice(0, 10);
  return bookedAt >= from && bookedAt <= to;
}

function tokenOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function confidenceFromScore(
  score: number,
  reasons: MatchReason[],
): MatchConfidence {
  const hasInvoiceRef = reasons.includes("invoice_number_in_remittance");
  const hasAmount = reasons.includes("amount_equal");
  const hasExactName = reasons.includes("counterparty_exact");

  if (hasInvoiceRef && hasAmount) return "exact";
  if (hasAmount && hasExactName && reasons.includes("date_in_window")) {
    return "exact";
  }
  if (score >= 80) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function scoreTransactionAgainstInvoice(
  transaction: BankTransaction,
  invoice: MatchableInvoice,
): MatchCandidate | null {
  if (transaction.currency !== invoice.currency) return null;
  if (transaction.amount <= 0) return null;

  const reasons: MatchReason[] = [];
  let score = 0;

  const epsilon = amountEpsilon(transaction.currency);
  const amountDiff = Math.abs(transaction.amount - invoice.totalAmount);
  if (amountDiff <= epsilon) {
    reasons.push("amount_equal");
    score += 45;
  } else if (amountDiff <= epsilon * 50) {
    reasons.push("amount_near");
    score += 15;
  } else {
    return null;
  }

  const remittance = compactRemittance(transaction.remittanceInfo ?? "");
  const invoiceRef = normalizeInvoiceNumber(invoice.invoiceNumber);
  if (invoiceRef && remittance.includes(invoiceRef)) {
    reasons.push("invoice_number_in_remittance");
    score += 40;
  }

  const txName = normalizePartyName(transaction.counterpartyName);
  const invName = normalizePartyName(invoice.clientName);
  const overlap = tokenOverlap(txName, invName);
  if (overlap >= 1) {
    reasons.push("counterparty_exact");
    score += 25;
  } else if (overlap >= 0.5) {
    reasons.push("counterparty_similar");
    score += 12;
  }

  if (isDateInWindow(invoice, transaction.bookedAt.slice(0, 10))) {
    reasons.push("date_in_window");
    score += 10;
  }

  const confidence = confidenceFromScore(score, reasons);
  const autoFinalize = confidence === "exact";

  return {
    transactionId: transaction.id,
    invoiceId: invoice.id,
    confidence,
    score,
    reasons,
    autoFinalize,
  };
}

/** Rank candidates per transaction; drop low-scoring noise. */
export function findMatchCandidates(
  transactions: BankTransaction[],
  invoices: MatchableInvoice[],
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const transaction of transactions) {
    const forTx: MatchCandidate[] = [];
    for (const invoice of invoices) {
      const candidate = scoreTransactionAgainstInvoice(transaction, invoice);
      if (candidate && candidate.score >= 45) {
        forTx.push(candidate);
      }
    }
    forTx.sort((a, b) => b.score - a.score || a.invoiceId.localeCompare(b.invoiceId));
    candidates.push(...forTx);
  }

  return candidates;
}

/** Review queue: everything that must not be auto-finalized. */
export function reviewQueue(candidates: MatchCandidate[]): MatchCandidate[] {
  return candidates.filter((candidate) => !candidate.autoFinalize);
}
