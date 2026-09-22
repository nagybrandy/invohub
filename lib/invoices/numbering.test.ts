// lib/invoices/numbering.test.ts
// A fake document_sequence table backing an in-memory upsert so we can assert
// the atomic-increment *behavior* (same key -> strictly increasing, distinct
// keys -> independent) without a real Postgres connection.
const mockStore = new Map<string, number>();

jest.mock("@/db", () => ({
  db: {
    insert: jest.fn(() => ({
      values: jest.fn((v: { userId: string; docType: string; year: number }) => ({
        onConflictDoUpdate: jest.fn(() => ({
          returning: jest.fn(async () => {
            const key = `${v.userId}|${v.docType}|${v.year}`;
            const next = (mockStore.get(key) ?? 0) + 1;
            mockStore.set(key, next);
            return [{ lastNumber: next }];
          }),
        })),
      })),
    })),
  },
}));

import {
  formatDocumentNumber,
  generateNextInvoiceNumber,
  nextSequenceNumber,
  prefixForDocType,
  sequenceBucketForDocType,
} from "@/lib/invoices/numbering";

beforeEach(() => {
  mockStore.clear();
});

describe("sequenceBucketForDocType / prefixForDocType", () => {
  it("maps invoice, storno, and modify onto the shared invoice bucket/prefix", () => {
    expect(sequenceBucketForDocType("invoice")).toBe("invoice");
    expect(sequenceBucketForDocType("storno")).toBe("invoice");
    expect(sequenceBucketForDocType("modify")).toBe("invoice");
    expect(prefixForDocType("invoice")).toBe("INV");
    expect(prefixForDocType("storno")).toBe("INV");
    expect(prefixForDocType("modify")).toBe("INV");
  });

  it("maps proforma to DBK and advance to ELO", () => {
    expect(sequenceBucketForDocType("proforma")).toBe("proforma");
    expect(prefixForDocType("proforma")).toBe("DBK");
    expect(sequenceBucketForDocType("advance")).toBe("advance");
    expect(prefixForDocType("advance")).toBe("ELO");
  });
});

describe("formatDocumentNumber", () => {
  it("zero-pads the sequence to 5 digits", () => {
    expect(formatDocumentNumber("INV", 2026, 1)).toBe("INV-2026-00001");
    expect(formatDocumentNumber("INV", 2026, 42)).toBe("INV-2026-00042");
    expect(formatDocumentNumber("DBK", 2026, 100000)).toBe("DBK-2026-100000");
  });
});

describe("nextSequenceNumber", () => {
  it("starts at 1 and increments for the same key", async () => {
    expect(await nextSequenceNumber("user-1", "invoice", 2026)).toBe(1);
    expect(await nextSequenceNumber("user-1", "invoice", 2026)).toBe(2);
    expect(await nextSequenceNumber("user-1", "invoice", 2026)).toBe(3);
  });

  it("keeps separate counters per user, docType, and year", async () => {
    expect(await nextSequenceNumber("user-1", "invoice", 2026)).toBe(1);
    expect(await nextSequenceNumber("user-2", "invoice", 2026)).toBe(1);
    expect(await nextSequenceNumber("user-1", "proforma", 2026)).toBe(1);
    expect(await nextSequenceNumber("user-1", "invoice", 2027)).toBe(1);
    expect(await nextSequenceNumber("user-1", "invoice", 2026)).toBe(2);
  });

  it("never repeats a number across many sequential calls (concurrency-safety proxy)", async () => {
    const seen = new Set<number>();
    for (let i = 0; i < 25; i++) {
      const n = await nextSequenceNumber("user-1", "invoice", 2026);
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
    expect(seen.size).toBe(25);
  });
});

describe("generateNextInvoiceNumber", () => {
  it("formats invoice numbers as INV-YYYY-NNNNN", async () => {
    expect(await generateNextInvoiceNumber("user-1", "invoice", 2026)).toBe(
      "INV-2026-00001"
    );
    expect(await generateNextInvoiceNumber("user-1", "invoice", 2026)).toBe(
      "INV-2026-00002"
    );
  });

  it("formats proforma as DBK- and advance as ELO-", async () => {
    expect(await generateNextInvoiceNumber("user-1", "proforma", 2026)).toBe(
      "DBK-2026-00001"
    );
    expect(await generateNextInvoiceNumber("user-1", "advance", 2026)).toBe(
      "ELO-2026-00001"
    );
  });

  it("storno shares the invoice sequence rather than minting its own prefix", async () => {
    expect(await generateNextInvoiceNumber("user-1", "invoice", 2026)).toBe(
      "INV-2026-00001"
    );
    expect(await generateNextInvoiceNumber("user-1", "storno", 2026)).toBe(
      "INV-2026-00002"
    );
    expect(await generateNextInvoiceNumber("user-1", "modify", 2026)).toBe(
      "INV-2026-00003"
    );
  });
});

describe("executor (finalize transaction) support", () => {
  it("runs the document_sequence upsert through the given executor, not the HTTP db client", async () => {
    const returning = jest.fn(async () => [{ lastNumber: 42 }]);
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({ onConflictDoUpdate: jest.fn(() => ({ returning })) })),
      })),
    };
    const { db } = require("@/db") as { db: { insert: jest.Mock } };
    db.insert.mockClear();

    expect(
      await generateNextInvoiceNumber("user-1", "storno", 2026, tx as never)
    ).toBe("INV-2026-00042");
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    // The shared store was never touched — the increment belongs to the tx.
    expect(mockStore.size).toBe(0);
  });
});
