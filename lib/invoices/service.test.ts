// lib/invoices/service.test.ts
const now = new Date();

function dbInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-x",
    userId: "user-1",
    companyId: null,
    clientId: null,
    invoiceNumber: "INV-2026-001",
    documentType: "invoice",
    clientName: "Acme Kft.",
    clientTaxNumber: "12345678-1-23",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    status: "draft",
    currency: "EUR",
    exchangeRate: null,
    notes: null,
    paymentLink: null,
    paymentMethod: null,
    paidAt: null,
    paidAmount: null,
    originalInvoiceId: null,
    modifiesInvoiceId: null,
    modificationIndex: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function dbLineItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-x",
    invoiceId: "inv-x",
    description: "Consulting",
    quantity: "2",
    unitPrice: "100",
    vatRate: 27,
    vatCategory: "normal",
    vatExemptionReason: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Queue of rows returned by successive `db.select().from(...).where(...)` calls, in call order. */
let mockSelectQueue: unknown[][] = [];
/** Queue of `lastNumber` values for the numbering module's insert-on-conflict upsert. */
let mockSequenceQueue: number[] = [];

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(mockSelectQueue.shift() ?? [])),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => {
        // Awaitable directly (plain invoice/line-item insert) AND chainable via
        // onConflictDoUpdate().returning() (document_sequence upsert in numbering.ts).
        const resolved = Promise.resolve(undefined);
        return {
          then: resolved.then.bind(resolved),
          catch: resolved.catch.bind(resolved),
          onConflictDoUpdate: jest.fn(() => ({
            returning: jest.fn(() =>
              Promise.resolve([{ lastNumber: mockSequenceQueue.shift() ?? 1 }])
            ),
          })),
        };
      }),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(undefined)),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => Promise.resolve(undefined)),
    })),
  },
}));

import { db } from "@/db";
import {
  buildStornoLineItems,
  createModificationDraft,
  createStornoInvoice,
  duplicateInvoice,
  listInvoicesInDateRange,
  markInvoicePaid,
} from "@/lib/invoices/service";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

jest.mock("@/lib/id", () => ({
  createId: jest
    .fn()
    .mockReturnValueOnce("new-inv-id")
    .mockReturnValueOnce("new-line-id")
    .mockReturnValueOnce("storno-inv-id")
    .mockReturnValueOnce("storno-line-id")
    .mockReturnValueOnce("modify-inv-id")
    .mockReturnValueOnce("modify-line-id"),
}));

beforeEach(() => {
  mockSelectQueue = [];
  mockSequenceQueue = [];
  mockDb.select.mockClear();
  mockDb.insert.mockClear();
  mockDb.update.mockClear();
  mockDb.delete.mockClear();
});

describe("duplicateInvoice", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("creates a draft copy with a blank number (never -COPY)", () => {
    const source = makeInvoice();
    const copy = duplicateInvoice(source);
    expect(copy.id).toBe("new-inv-id");
    expect(copy.invoiceNumber).toBe("");
    expect(copy.status).toBe("draft");
    expect(copy.lineItems[0].id).toBe("new-line-id");
    expect(copy.createdAt).toBe("2026-07-01T12:00:00.000Z");
  });

  it("resets storno/modify document type back to a plain invoice", () => {
    const source = makeInvoice({ documentType: "storno", originalInvoiceId: "inv-orig" });
    const copy = duplicateInvoice(source);
    expect(copy.documentType).toBe("invoice");
    expect(copy.originalInvoiceId).toBeUndefined();
  });

  it("clears payment fields on the copy", () => {
    const source = makeInvoice({ paymentMethod: "cash", paidAmount: 100, paidAt: "2026-01-01" });
    const copy = duplicateInvoice(source);
    expect(copy.paymentMethod).toBeUndefined();
    expect(copy.paidAmount).toBeUndefined();
    expect(copy.paidAt).toBeUndefined();
  });
});

describe("buildStornoLineItems", () => {
  it("negates quantities and assigns new ids", () => {
    const source = makeInvoice({ lineItems: [makeLineItem({ quantity: 2 })] });
    const items = buildStornoLineItems(source);
    expect(items[0].quantity).toBe(-2);
    expect(items[0].id).not.toBe(source.lineItems[0].id);
  });
});

describe("createStornoInvoice", () => {
  it("creates a new finalized storno document and cancels the original", async () => {
    const source = makeInvoice({ id: "inv-orig", invoiceNumber: "INV-2026-001" });

    // Storno is finalized immediately, so it allocates a number from the shared invoice sequence.
    mockSequenceQueue = [2];

    // Inside upsertInvoice: getInvoiceById(storno.id) -> not found, then re-fetch after insert.
    mockSelectQueue = [
      [], // getInvoiceById before insert: no existing row
      [
        dbInvoiceRow({
          id: "storno-inv-id",
          invoiceNumber: "INV-2026-002",
          documentType: "storno",
          status: "sent",
          originalInvoiceId: "inv-orig",
        }),
      ],
      [dbLineItemRow({ id: "storno-line-id", invoiceId: "storno-inv-id", quantity: "-2" })],
    ];

    const saved = await createStornoInvoice("user-1", source);

    expect(saved.id).toBe("storno-inv-id");
    expect(saved.documentType).toBe("storno");
    expect(saved.originalInvoiceId).toBe("inv-orig");
    expect(saved.status).toBe("sent");
    expect(saved.lineItems[0].quantity).toBe(-2);

    // The original invoice was flipped to cancelled via a direct update.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});

describe("createModificationDraft", () => {
  it("creates a minimal draft pointing at the source with modificationIndex 1", async () => {
    const source = makeInvoice({ id: "inv-orig", invoiceNumber: "INV-2026-001" });

    mockSelectQueue = [
      [], // findInvoicesReferencing(modifiesInvoiceId) -> no prior corrections
      [], // getInvoiceById(draft.id) before insert: no existing row
      [
        dbInvoiceRow({
          id: "modify-inv-id",
          invoiceNumber: "",
          documentType: "modify",
          status: "draft",
          modifiesInvoiceId: "inv-orig",
          modificationIndex: 1,
        }),
      ],
      [dbLineItemRow({ id: "modify-line-id", invoiceId: "modify-inv-id" })],
    ];

    const draft = await createModificationDraft("user-1", source);

    expect(draft.id).toBe("modify-inv-id");
    expect(draft.documentType).toBe("modify");
    expect(draft.status).toBe("draft");
    expect(draft.invoiceNumber).toBe("");
    expect(draft.modifiesInvoiceId).toBe("inv-orig");
    expect(draft.modificationIndex).toBe(1);
  });
});

describe("markInvoicePaid", () => {
  it("records full payment and derives status paid", async () => {
    mockSelectQueue = [
      // getInvoiceById(id) inside markInvoicePaid
      [dbInvoiceRow({ id: "inv-1", status: "sent", dueDate: "2026-12-31" })],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
      // getInvoiceById inside upsertInvoice (existing row found)
      [dbInvoiceRow({ id: "inv-1", status: "sent", dueDate: "2026-12-31" })],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
      // getInvoiceById after save
      [
        dbInvoiceRow({
          id: "inv-1",
          status: "paid",
          dueDate: "2026-12-31",
          paymentMethod: "transfer",
          paidAmount: "1000",
          paidAt: now,
        }),
      ],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
    ];

    const result = await markInvoicePaid("user-1", "inv-1", { paymentMethod: "transfer" });

    expect(result?.status).toBe("paid");
    expect(result?.paymentMethod).toBe("transfer");
    expect(result?.paidAmount).toBe(1000);
  });

  it("returns null when the invoice doesn't exist", async () => {
    mockSelectQueue = [[]];
    const result = await markInvoicePaid("user-1", "missing", {});
    expect(result).toBeNull();
  });

  it("accumulates a second partial payment instead of overwriting the first", async () => {
    // Invoice total is 1000; 400 was already paid (partially_paid). A
    // second 300 payment should land on 700 total paid, not overwrite the
    // recorded amount down to 300.
    mockSelectQueue = [
      // getInvoiceById(id) inside markInvoicePaid
      [dbInvoiceRow({ id: "inv-1", status: "partially_paid", dueDate: "2026-12-31", paidAmount: "400" })],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
      // getInvoiceById inside upsertInvoice (existing row found)
      [dbInvoiceRow({ id: "inv-1", status: "partially_paid", dueDate: "2026-12-31", paidAmount: "400" })],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
      // getInvoiceById after save
      [
        dbInvoiceRow({
          id: "inv-1",
          status: "partially_paid",
          dueDate: "2026-12-31",
          paymentMethod: "transfer",
          paidAmount: "700",
          paidAt: now,
        }),
      ],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
    ];

    const result = await markInvoicePaid("user-1", "inv-1", {
      paymentMethod: "transfer",
      paidAmount: 300,
    });

    expect(result?.status).toBe("partially_paid");
    expect(result?.paidAmount).toBe(700);
  });

  it("defaults the payment amount to the outstanding balance, not the full total, for an already-partially-paid invoice", async () => {
    // 400 of a 1000 total already paid, no paidAmount override supplied —
    // the remaining 600 should be recorded, taking the invoice to fully
    // paid (1000), not 400 (the total, silently overwriting) or 400+1000.
    mockSelectQueue = [
      [dbInvoiceRow({ id: "inv-1", status: "partially_paid", dueDate: "2026-12-31", paidAmount: "400" })],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
      [dbInvoiceRow({ id: "inv-1", status: "partially_paid", dueDate: "2026-12-31", paidAmount: "400" })],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
      [
        dbInvoiceRow({
          id: "inv-1",
          status: "paid",
          dueDate: "2026-12-31",
          paymentMethod: "cash",
          paidAmount: "1000",
          paidAt: now,
        }),
      ],
      [dbLineItemRow({ invoiceId: "inv-1", quantity: "1", unitPrice: "1000", vatRate: 0 })],
    ];

    const result = await markInvoicePaid("user-1", "inv-1", { paymentMethod: "cash" });

    expect(result?.status).toBe("paid");
    expect(result?.paidAmount).toBe(1000);
  });
});

describe("listInvoicesInDateRange", () => {
  function invoicePageChain(rows: unknown[]) {
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn(() => Promise.resolve(rows)),
    };
  }

  function lineItemChain(rows: unknown[]) {
    return {
      from: jest.fn().mockReturnThis(),
      where: jest.fn(() => Promise.resolve(rows)),
    };
  }

  it("paginates through full pages and stops at a short page (SQL date filter, not JS filtering)", async () => {
    const page1 = Array.from({ length: 500 }, (_, i) =>
      dbInvoiceRow({ id: `inv-${i}`, issueDate: "2026-03-01" })
    );
    const page2 = [dbInvoiceRow({ id: "inv-500", issueDate: "2026-03-02" })];

    mockDb.select
      .mockImplementationOnce(() => invoicePageChain(page1))
      .mockImplementationOnce(() => lineItemChain([]))
      .mockImplementationOnce(() => invoicePageChain(page2))
      .mockImplementationOnce(() => lineItemChain([]));

    const invoices = await listInvoicesInDateRange("user-1", "2026-01-01", "2026-12-31");

    expect(invoices).toHaveLength(501);
    // 2 pages x (1 invoice select + 1 line-item select) = 4 db.select calls total.
    expect(mockDb.select).toHaveBeenCalledTimes(4);
  });

  it("stops immediately when the first page is empty", async () => {
    mockDb.select.mockImplementationOnce(() => invoicePageChain([]));

    const invoices = await listInvoicesInDateRange("user-1", "2026-01-01", "2026-12-31");

    expect(invoices).toHaveLength(0);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });
});
