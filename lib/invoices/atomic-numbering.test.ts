// lib/invoices/atomic-numbering.test.ts
// 23/2014. NGM rendelet 8. § (1) a): invoice numbers must be continuous
// (gapless) and never repeat. These tests pin the transactional contract of
// upsertInvoice's finalize path against an in-memory fake of Postgres
// transaction semantics (no live database):
//   - the document_sequence increment and the invoice + line-item writes
//     commit together or not at all (a failure never burns a number);
//   - every validation that can throw runs BEFORE the transaction opens;
//   - the sequence row stays locked until COMMIT/ROLLBACK, so concurrent
//     finalizations in the same series get distinct, consecutive numbers.

type Row = Record<string, unknown>;

/** Committed state of the fake database. */
const mockCommitted = {
  sequences: new Map<string, number>(),
  invoices: new Map<string, Row>(),
  lineItems: new Map<string, Row[]>(),
};
/** Row-level locks on document_sequence keys, held until the owning tx ends. */
const mockSequenceLocks = new Map<string, Promise<void>>();
/** Test hooks. */
let mockFailOn: { table: "invoice" | "invoice_line_item"; times: number } | null = null;
let mockLockRowOverride: Row | null = null;
let mockBeforeFail: (() => Promise<void>) | null = null;

function mockCollectParams(node: unknown, out: unknown[] = [], seen = new Set<unknown>()): unknown[] {
  if (!node || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    node.forEach((n) => mockCollectParams(n, out, seen));
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (obj.constructor?.name === "Param") out.push(obj.value);
  if (Array.isArray(obj.queryChunks)) mockCollectParams(obj.queryChunks, out, seen);
  return out;
}

function mockTableName(table: unknown): string {
  const sym = Object.getOwnPropertySymbols(table as object).find(
    (s) => s.toString() === "Symbol(drizzle:Name)"
  );
  return sym ? String((table as Record<symbol, unknown>)[sym]) : "";
}

function mockFindInvoice(store: Map<string, Row>, where: unknown): Row | undefined {
  const params = mockCollectParams(where);
  for (const p of params) {
    if (typeof p === "string" && store.has(p)) return store.get(p);
  }
  return undefined;
}

/** Read-only committed-state client standing in for `db` (neon-http). */
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn((table: unknown) => ({
        where: jest.fn(async (where: unknown) => {
          const name = mockTableName(table);
          if (name === "invoice") {
            const row = mockFindInvoice(mockCommitted.invoices, where);
            return row ? [row] : [];
          }
          if (name === "invoice_line_item") {
            const params = mockCollectParams(where);
            const id = params.find((p) => typeof p === "string" && mockCommitted.lineItems.has(p));
            return id ? (mockCommitted.lineItems.get(id as string) ?? []) : [];
          }
          return [];
        }),
      })),
    })),
    insert: jest.fn(() => {
      throw new Error("finalize path must write through the transaction, never the HTTP db client");
    }),
    update: jest.fn(() => ({
      set: jest.fn(() => ({ where: jest.fn(async () => undefined) })),
    })),
    delete: jest.fn(() => ({ where: jest.fn(async () => undefined) })),
  },
}));

jest.mock("@/db/transaction", () => ({
  runInTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    // Staged (uncommitted) writes of this transaction.
    const staged = {
      sequences: new Map<string, number>(),
      invoices: new Map<string, Row>(),
      lineItems: new Map<string, Row[]>(),
      deletedLineItemsFor: new Set<string>(),
    };
    const heldLocks: Array<() => void> = [];

    const maybeFail = async (table: "invoice" | "invoice_line_item") => {
      if (mockFailOn && mockFailOn.table === table && mockFailOn.times > 0) {
        mockFailOn.times -= 1;
        if (mockBeforeFail) await mockBeforeFail();
        throw new Error(`simulated ${table} write failure`);
      }
    };

    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn((where: unknown) => ({
            for: jest.fn(async (mode: string) => {
              expect(mode).toBe("update");
              if (mockLockRowOverride) return [mockLockRowOverride];
              const row = mockFindInvoice(mockCommitted.invoices, where);
              return row ? [{ invoiceNumber: row.invoiceNumber, status: row.status }] : [];
            }),
          })),
        })),
      })),
      insert: jest.fn((table: unknown) => ({
        values: jest.fn((values: Row | Row[]) => {
          const name = mockTableName(table);
          if (name === "document_sequence") {
            const v = values as Row;
            const key = `${v.userId}|${v.docType}|${v.year}`;
            return {
              onConflictDoUpdate: jest.fn(() => ({
                returning: jest.fn(async () => {
                  // Postgres row lock: wait for any other tx holding this key.
                  while (mockSequenceLocks.has(key)) {
                    await mockSequenceLocks.get(key);
                  }
                  let release!: () => void;
                  mockSequenceLocks.set(key, new Promise<void>((r) => (release = r)));
                  heldLocks.push(() => {
                    mockSequenceLocks.delete(key);
                    release();
                  });
                  const current = staged.sequences.get(key) ?? mockCommitted.sequences.get(key) ?? 0;
                  staged.sequences.set(key, current + 1);
                  return [{ lastNumber: current + 1 }];
                }),
              })),
            };
          }
          const run = async () => {
            if (name === "invoice") {
              await maybeFail("invoice");
              const v = values as Row;
              staged.invoices.set(v.id as string, { ...v });
            } else if (name === "invoice_line_item") {
              await maybeFail("invoice_line_item");
              const rows = values as Row[];
              const id = rows[0]?.invoiceId as string;
              staged.lineItems.set(id, rows);
            }
          };
          const p = run();
          return { then: p.then.bind(p), catch: p.catch.bind(p) };
        }),
      })),
      update: jest.fn(() => ({
        set: jest.fn((values: Row) => ({
          where: jest.fn(async (where: unknown) => {
            await maybeFail("invoice");
            const row = mockFindInvoice(mockCommitted.invoices, where);
            if (row) staged.invoices.set(row.id as string, { ...row, ...values });
          }),
        })),
      })),
      delete: jest.fn(() => ({
        where: jest.fn(async (where: unknown) => {
          const params = mockCollectParams(where);
          params.forEach((p) => typeof p === "string" && staged.deletedLineItemsFor.add(p));
        }),
      })),
    };

    try {
      const result = await fn(tx);
      // COMMIT
      staged.sequences.forEach((v, k) => mockCommitted.sequences.set(k, v));
      staged.invoices.forEach((v, k) => mockCommitted.invoices.set(k, v));
      staged.deletedLineItemsFor.forEach((id) => mockCommitted.lineItems.delete(id));
      staged.lineItems.forEach((v, k) => mockCommitted.lineItems.set(k, v));
      return result;
    } finally {
      // COMMIT or ROLLBACK both release the row locks; on throw the staged
      // writes are simply discarded.
      heldLocks.forEach((release) => release());
    }
  }),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

import { db } from "@/db";
import { invoice as invoiceTable } from "@/db/schema";
import { runInTransaction } from "@/db/transaction";
import { getCompanyByUserId } from "@/lib/companies/service";
import { mapInvoiceToDb, mapLineItemToDb } from "@/lib/invoices/mappers";
import {
  CompanyProfileIncompleteError,
  InvoiceAlreadyFinalizedError,
  finalizeInvoice,
  upsertInvoice,
} from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const mockRunInTransaction = runInTransaction as jest.MockedFunction<typeof runInTransaction>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;

const COMPLETE_COMPANY = {
  name: "Acme Kft.",
  taxNumber: "12345678-1-23",
  zipCode: "1011",
  city: "Budapest",
  address: "Fő utca 1.",
};

const SEQ_KEY = "user-1|invoice|2026";

function draft(overrides: Partial<Invoice> = {}): Invoice {
  return makeInvoice({
    id: "inv-1",
    invoiceNumber: "",
    status: "draft",
    clientZipCode: "1011",
    clientCity: "Budapest",
    clientAddress: "Fő utca 1.",
    lineItems: [makeLineItem({ id: "line-1" })],
    ...overrides,
  });
}

/** Seeds a committed draft row (plus its line items) into the fake database. */
function seedCommitted(inv: Invoice) {
  const now = new Date();
  mockCommitted.invoices.set(inv.id, {
    ...mapInvoiceToDb(inv, "user-1"),
    createdAt: now,
    updatedAt: now,
  });
  mockCommitted.lineItems.set(
    inv.id,
    inv.lineItems.map((item, index) => ({
      ...mapLineItemToDb(item, inv.id, index),
      createdAt: now,
      updatedAt: now,
    }))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCommitted.sequences.clear();
  mockCommitted.invoices.clear();
  mockCommitted.lineItems.clear();
  mockSequenceLocks.clear();
  mockFailOn = null;
  mockLockRowOverride = null;
  mockBeforeFail = null;
  mockGetCompany.mockResolvedValue(COMPLETE_COMPANY as never);
});

describe("upsertInvoice — atomic numbering (23/2014. NGM rendelet 8. § (1) a))", () => {
  it("assigns the number and writes the invoice + line items in ONE transaction", async () => {
    const saved = await upsertInvoice("user-1", draft({ status: "unpaid" }));

    expect(mockRunInTransaction).toHaveBeenCalledTimes(1);
    expect(saved.invoiceNumber).toBe("INV-2026-00001");
    expect(saved.lineItems).toHaveLength(1);
    expect(mockCommitted.sequences.get(SEQ_KEY)).toBe(1);
    // Nothing was written outside the transaction.
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("rolls the counter back when the line-item write fails after the increment (no burnt number)", async () => {
    mockFailOn = { table: "invoice_line_item", times: 1 };

    await expect(upsertInvoice("user-1", draft({ status: "unpaid" }))).rejects.toThrow(
      "simulated invoice_line_item write failure"
    );
    expect(mockCommitted.sequences.get(SEQ_KEY)).toBeUndefined();
    expect(mockCommitted.invoices.size).toBe(0);

    // The retry gets number 1 — the failed attempt left no gap.
    const saved = await upsertInvoice("user-1", draft({ status: "unpaid" }));
    expect(saved.invoiceNumber).toBe("INV-2026-00001");
    expect(mockCommitted.sequences.get(SEQ_KEY)).toBe(1);
  });

  it("rolls back an existing draft's finalize when the invoice UPDATE fails — the draft stays an unnumbered draft", async () => {
    const existing = draft();
    seedCommitted(existing);
    mockFailOn = { table: "invoice", times: 1 };

    await expect(upsertInvoice("user-1", { ...existing, status: "unpaid" })).rejects.toThrow(
      "simulated invoice write failure"
    );

    expect(mockCommitted.sequences.get(SEQ_KEY)).toBeUndefined();
    expect(mockCommitted.invoices.get("inv-1")).toMatchObject({ status: "draft", invoiceNumber: "" });
    // Line items were not deleted by the rolled-back transaction.
    expect(mockCommitted.lineItems.get("inv-1")).toHaveLength(1);
  });

  it("checks the company profile BEFORE opening the transaction (throw never touches the counter)", async () => {
    mockGetCompany.mockResolvedValueOnce({ ...COMPLETE_COMPANY, taxNumber: "" } as never);

    await expect(upsertInvoice("user-1", draft({ status: "unpaid" }))).rejects.toBeInstanceOf(
      CompanyProfileIncompleteError
    );
    expect(mockRunInTransaction).not.toHaveBeenCalled();
    expect(mockCommitted.sequences.size).toBe(0);
  });

  it("refuses to renumber an already-numbered invoice BEFORE opening the transaction (finalized lock)", async () => {
    const numbered = draft({ status: "unpaid", invoiceNumber: "INV-2026-00007" });
    seedCommitted(numbered);

    // A caller that lost the number (blank) but keeps a finalized status must
    // never get a second number for the same document.
    await expect(
      upsertInvoice("user-1", { ...numbered, invoiceNumber: "" })
    ).rejects.toBeInstanceOf(InvoiceAlreadyFinalizedError);
    expect(mockRunInTransaction).not.toHaveBeenCalled();
    expect(mockCommitted.sequences.size).toBe(0);
  });

  it("re-checks the finalized lock under SELECT … FOR UPDATE inside the tx and rolls back without incrementing", async () => {
    seedCommitted(draft());
    // Another request finalized the same draft between our pre-check and the lock.
    mockLockRowOverride = { invoiceNumber: "INV-2026-00001", status: "unpaid" };

    await expect(upsertInvoice("user-1", draft({ status: "unpaid" }))).rejects.toBeInstanceOf(
      InvoiceAlreadyFinalizedError
    );
    expect(mockRunInTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommitted.sequences.size).toBe(0);
    expect(mockCommitted.invoices.get("inv-1")).toMatchObject({ invoiceNumber: "" });
  });

  it("never opens a transaction or touches the counter for a plain draft save", async () => {
    // Draft saves still go through the HTTP client — swap the throwing
    // insert for one that commits straight away for this one test.
    (db.insert as jest.Mock).mockImplementation((table: unknown) => ({
      values: jest.fn(async (v: Row) => {
        if (mockTableName(table) === "invoice") mockCommitted.invoices.set(v.id as string, v);
      }),
    }));

    await upsertInvoice("user-1", draft());
    expect(mockRunInTransaction).not.toHaveBeenCalled();
    expect(mockCommitted.sequences.size).toBe(0);
  });

  it("never opens a transaction for an update that keeps an existing number (e.g. mark paid)", async () => {
    const numbered = draft({ status: "unpaid", invoiceNumber: "INV-2026-00003" });
    seedCommitted(numbered);
    (db.insert as jest.Mock).mockImplementation(() => ({
      values: jest.fn(async () => undefined),
    }));

    await upsertInvoice("user-1", { ...numbered, status: "paid" });
    expect(mockRunInTransaction).not.toHaveBeenCalled();
  });

  it("keeps the per-type series: storno and modify share INV-, proforma uses DBK-", async () => {
    const a = await upsertInvoice("user-1", draft({ id: "a", status: "unpaid" }));
    const b = await upsertInvoice("user-1", draft({ id: "b", documentType: "storno", status: "sent" }));
    const c = await upsertInvoice("user-1", draft({ id: "c", documentType: "modify", status: "unpaid" }));
    const d = await upsertInvoice("user-1", draft({ id: "d", documentType: "proforma", status: "proforma" }));

    expect([a, b, c, d].map((i) => i.invoiceNumber)).toEqual([
      "INV-2026-00001",
      "INV-2026-00002",
      "INV-2026-00003",
      "DBK-2026-00001",
    ]);
  });

  it("gives two concurrent finalizations in the same series distinct, consecutive numbers", async () => {
    const [x, y] = await Promise.all([
      upsertInvoice("user-1", draft({ id: "x", status: "unpaid" })),
      upsertInvoice("user-1", draft({ id: "y", status: "unpaid" })),
    ]);

    expect([x.invoiceNumber, y.invoiceNumber].sort()).toEqual([
      "INV-2026-00001",
      "INV-2026-00002",
    ]);
    expect(mockCommitted.sequences.get(SEQ_KEY)).toBe(2);
  });

  it("a concurrent finalization that fails after incrementing releases its number to the waiter — no gap", async () => {
    // "x" increments first and holds the sequence row lock; while it holds it,
    // "y" starts and blocks on the lock. Then "x" fails and rolls back.
    let startY!: () => void;
    const yStarted = new Promise<void>((resolve) => (startY = resolve));
    let yPromise: Promise<Invoice> | undefined;
    mockFailOn = { table: "invoice", times: 1 };
    mockBeforeFail = async () => {
      yPromise = upsertInvoice("user-1", draft({ id: "y", status: "unpaid" }));
      startY();
      // Let "y" run up to the sequence lock before "x" rolls back.
      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    await expect(upsertInvoice("user-1", draft({ id: "x", status: "unpaid" }))).rejects.toThrow();
    await yStarted;
    const y = await yPromise!;

    expect(y.invoiceNumber).toBe("INV-2026-00001");
    expect(mockCommitted.sequences.get(SEQ_KEY)).toBe(1);
    expect(mockCommitted.invoices.has("x")).toBe(false);
  });
});

describe("finalizeInvoice — atomic path", () => {
  it("maps a lost finalize race (InvoiceAlreadyFinalizedError) to not_draft without burning a number", async () => {
    seedCommitted(draft());
    mockLockRowOverride = { invoiceNumber: "INV-2026-00001", status: "unpaid" };

    const result = await finalizeInvoice("user-1", "inv-1");
    expect(result).toEqual({ ok: false, reason: "not_draft" });
    expect(mockCommitted.sequences.size).toBe(0);
  });

  it("finalizes a draft: number, status and line items land together", async () => {
    seedCommitted(draft());
    const result = await finalizeInvoice("user-1", "inv-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invoice.invoiceNumber).toBe("INV-2026-00001");
      expect(result.invoice.status).toBe("unpaid");
      expect(result.invoice.lineItems).toHaveLength(1);
    }
    expect(mockCommitted.invoices.get("inv-1")).toMatchObject({
      invoiceNumber: "INV-2026-00001",
      status: "unpaid",
    });
  });
});

// Keeps the schema import meaningful for readers: the fake keys off the
// real drizzle table names.
it("fake database recognises the real invoice table name", () => {
  expect(mockTableName(invoiceTable)).toBe("invoice");
});
