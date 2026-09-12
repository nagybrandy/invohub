// lib/bank-matching/score.test.ts
import {
  findMatchCandidates,
  reviewQueue,
  scoreTransactionAgainstInvoice,
} from "@/lib/bank-matching/score";
import type { BankTransaction, MatchableInvoice } from "@/lib/bank-matching/types";

const invoice: MatchableInvoice = {
  id: "inv-1",
  invoiceNumber: "IH-2026/0042",
  clientName: "Kovács Éva Kft.",
  totalAmount: 127000,
  currency: "HUF",
  issueDate: "2026-09-01",
  dueDate: "2026-09-15",
  status: "sent",
};

const baseTx: BankTransaction = {
  id: "tx-1",
  amount: 127000,
  currency: "HUF",
  bookedAt: "2026-09-10",
  counterpartyName: "Kovacs Eva Kft",
  remittanceInfo: "IH-2026/0042",
};

describe("scoreTransactionAgainstInvoice", () => {
  it("marks amount + invoice number as exact and auto-finalizable", () => {
    const candidate = scoreTransactionAgainstInvoice(baseTx, invoice);
    expect(candidate).toMatchObject({
      confidence: "exact",
      autoFinalize: true,
    });
    expect(candidate?.reasons).toEqual(
      expect.arrayContaining([
        "amount_equal",
        "invoice_number_in_remittance",
      ]),
    );
  });

  it("marks amount + exact name + date as exact without remittance", () => {
    const candidate = scoreTransactionAgainstInvoice(
      { ...baseTx, remittanceInfo: undefined },
      invoice,
    );
    expect(candidate?.confidence).toBe("exact");
    expect(candidate?.autoFinalize).toBe(true);
  });

  it("keeps amount-only matches in review (not auto-finalize)", () => {
    const candidate = scoreTransactionAgainstInvoice(
      {
        ...baseTx,
        counterpartyName: "Ismeretlen Partner Zrt",
        remittanceInfo: "átutalás",
      },
      invoice,
    );
    expect(candidate?.autoFinalize).toBe(false);
    expect(candidate?.confidence).not.toBe("exact");
  });

  it("returns null when currency differs or amount is far", () => {
    expect(
      scoreTransactionAgainstInvoice({ ...baseTx, currency: "EUR" }, invoice),
    ).toBeNull();
    expect(
      scoreTransactionAgainstInvoice({ ...baseTx, amount: 50000 }, invoice),
    ).toBeNull();
  });

  it("ignores outgoing (non-credit) transactions", () => {
    expect(
      scoreTransactionAgainstInvoice({ ...baseTx, amount: -127000 }, invoice),
    ).toBeNull();
  });
});

describe("findMatchCandidates + reviewQueue", () => {
  it("ranks best invoice first and isolates review items", () => {
    const other: MatchableInvoice = {
      ...invoice,
      id: "inv-2",
      invoiceNumber: "IH-2026/0099",
      clientName: "Másik Cég Kft.",
      totalAmount: 127000,
    };

    const candidates = findMatchCandidates([baseTx], [other, invoice]);
    expect(candidates[0]?.invoiceId).toBe("inv-1");
    expect(candidates[0]?.autoFinalize).toBe(true);

    const uncertain = findMatchCandidates(
      [
        {
          ...baseTx,
          id: "tx-2",
          remittanceInfo: "",
          counterpartyName: "Ismeretlen",
        },
      ],
      [invoice],
    );
    expect(reviewQueue(uncertain).every((c) => !c.autoFinalize)).toBe(true);
  });
});
