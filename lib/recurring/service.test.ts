// lib/recurring/service.test.ts
import type { Invoice } from "@/lib/invoices/types";

// Hoisted jest mocks cannot close over imports, so they require lazily.
jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  ...jest.requireActual("@/lib/recurring/fake-db").operatorMocks,
}));

const mockTables: Map<unknown, Record<string, unknown>[]> = new Map();
const mockUpsert = jest.fn();
const mockNotify = jest.fn();
const mockGetInvoice = jest.fn();

let mockFakeDb: unknown;
jest.mock("@/db", () => ({
  get db() {
    if (mockFakeDb) return mockFakeDb;
    const { createFakeDb } = jest.requireActual("@/lib/recurring/fake-db");
    const schema = jest.requireActual("@/db/schema");
    const uniques = new Map<unknown, string[]>([
      [schema.recurringInvoiceRun, ["templateId", "periodKey"]],
    ]);
    mockFakeDb = createFakeDb(mockTables, uniques);
    return mockFakeDb;
  },
}));

let mockIdCounter = 0;
jest.mock("@/lib/id", () => ({ createId: () => `id-${++mockIdCounter}` }));
jest.mock("@/lib/invoices/service", () => ({
  upsertInvoice: (...a: unknown[]) => mockUpsert(...a),
  getInvoiceById: (...a: unknown[]) => mockGetInvoice(...a),
}));
jest.mock("@/lib/notifications/service", () => ({
  createNotification: (...a: unknown[]) => mockNotify(...a),
}));

import { recurringInvoiceRun, recurringInvoiceTemplate } from "@/db/schema";
import {
  RecurringTemplateError,
  createTemplateFromInvoice,
  deleteTemplate,
  generateDueDrafts,
  listTemplates,
  updateTemplate,
} from "@/lib/recurring/service";

const NOON = (day: string) => new Date(`${day}T10:00:00Z`);

function sourceInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-src",
    invoiceNumber: "INV-2026-001",
    documentType: "invoice",
    clientName: "Acme Kft.",
    clientId: "client-1",
    clientTaxNumber: "12345678-1-23",
    clientZipCode: "1011",
    clientCity: "Budapest",
    clientAddress: "Fő utca 1.",
    clientCountry: "HU",
    issueDate: "2026-10-01",
    dueDate: "2026-10-09",
    fulfillmentDate: "2026-10-01",
    status: "sent",
    currency: "EUR",
    exchangeRate: 395,
    lineItems: [
      { id: "li-1", description: "Retainer", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal", unit: "db" },
    ],
    notes: "Köszönjük",
    paymentMethod: "transfer",
    language: "en",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const rowsOf = (t: unknown) => (mockTables.get(t) ?? []) as Record<string, any>[];

beforeEach(() => {
  mockTables.clear();
  mockIdCounter = 0;
  mockUpsert.mockReset().mockImplementation(async (_u: string, inv: Invoice) => inv);
  mockNotify.mockReset().mockResolvedValue({});
  mockGetInvoice.mockReset();
});

describe("createTemplateFromInvoice", () => {
  it("snapshots the invoice content and starts at the first occurrence on/after today", async () => {
    const t = await createTemplateFromInvoice(
      "acct-A",
      sourceInvoice(),
      { frequency: "monthly", startDate: "2026-01-31" },
      { now: NOON("2026-11-08") }
    );
    expect(t).toMatchObject({
      userId: "acct-A",
      clientName: "Acme Kft.",
      currency: "EUR",
      language: "en",
      paymentMethod: "transfer",
      paymentTermDays: 8,
      status: "active",
      nextIndex: 10,
      nextRunDate: "2026-11-30",
      sourceInvoiceId: "inv-src",
    });
    expect(t.lineItems).toHaveLength(1);
    expect(rowsOf(recurringInvoiceTemplate)).toHaveLength(1);
  });

  it("keeps a future start date as-is", async () => {
    const t = await createTemplateFromInvoice(
      "acct-A",
      sourceInvoice(),
      { frequency: "yearly", startDate: "2027-03-01" },
      { now: NOON("2026-11-08") }
    );
    expect(t.nextIndex).toBe(0);
    expect(t.nextRunDate).toBe("2027-03-01");
  });

  it("rejects storno/helyesbítő documents and invalid or already-ended schedules", async () => {
    await expect(
      createTemplateFromInvoice("a", sourceInvoice({ documentType: "storno" }), { frequency: "monthly", startDate: "2027-01-01" })
    ).rejects.toMatchObject({ code: "unsupportedDocumentType" });
    await expect(
      createTemplateFromInvoice("a", sourceInvoice(), { frequency: "monthly", startDate: "2027-02-30" })
    ).rejects.toMatchObject({ code: "invalidSchedule" });
    await expect(
      createTemplateFromInvoice(
        "a",
        sourceInvoice(),
        { frequency: "monthly", startDate: "2026-01-01", endDate: "2026-03-01" },
        { now: NOON("2026-11-08") }
      )
    ).rejects.toMatchObject({ code: "scheduleEnded" });
  });
});

describe("account scoping", () => {
  it("lists, updates and deletes only the active account's templates", async () => {
    const a = await createTemplateFromInvoice("acct-A", sourceInvoice(), { frequency: "monthly", startDate: "2027-01-01" }, { now: NOON("2026-11-08") });
    const b = await createTemplateFromInvoice("acct-B", sourceInvoice(), { frequency: "monthly", startDate: "2027-01-01" }, { now: NOON("2026-11-08") });

    expect((await listTemplates("acct-A")).map((t) => t.id)).toEqual([a.id]);
    expect((await listTemplates("acct-B")).map((t) => t.id)).toEqual([b.id]);

    // B's template is invisible and untouchable for A.
    expect(await updateTemplate("acct-A", b.id, { status: "paused" })).toBeNull();
    expect(await deleteTemplate("acct-A", b.id)).toBe(false);
    expect(rowsOf(recurringInvoiceTemplate).find((r) => r.id === b.id)).toMatchObject({ status: "active" });

    expect(await deleteTemplate("acct-B", b.id)).toBe(true);
    expect(await listTemplates("acct-B")).toEqual([]);
    expect(await listTemplates("acct-A")).toHaveLength(1);
  });
});

describe("updateTemplate", () => {
  it("pause stops generation; resume skips the paused periods", async () => {
    const t = await createTemplateFromInvoice("u", sourceInvoice(), { frequency: "monthly", startDate: "2026-11-01" }, { now: NOON("2026-10-20") });
    await updateTemplate("u", t.id, { status: "paused" }, { now: NOON("2026-10-21") });
    const res = await generateDueDrafts({ now: NOON("2026-12-15") });
    expect(res.created).toBe(0);

    const resumed = await updateTemplate("u", t.id, { status: "active" }, { now: NOON("2026-12-15") });
    expect(resumed).toMatchObject({ status: "active", nextRunDate: "2027-01-01" });
  });

  it("editing the schedule recomputes the next run; editing only the name does not", async () => {
    const t = await createTemplateFromInvoice("u", sourceInvoice(), { frequency: "monthly", startDate: "2026-11-01" }, { now: NOON("2026-10-20") });
    const renamed = await updateTemplate("u", t.id, { name: "Retainer" }, { now: NOON("2026-12-20") });
    expect(renamed).toMatchObject({ name: "Retainer", nextIndex: 0, nextRunDate: "2026-11-01" });

    const edited = await updateTemplate("u", t.id, { schedule: { frequency: "quarterly", startDate: "2027-02-15" } }, { now: NOON("2026-12-20") });
    expect(edited).toMatchObject({ frequency: "quarterly", nextRunDate: "2027-02-15" });
  });

  it("rejects an invalid schedule edit", async () => {
    const t = await createTemplateFromInvoice("u", sourceInvoice(), { frequency: "monthly", startDate: "2026-11-01" }, { now: NOON("2026-10-20") });
    await expect(updateTemplate("u", t.id, { schedule: { frequency: "monthly", startDate: "bad" } })).rejects.toBeInstanceOf(RecurringTemplateError);
  });
});

describe("generateDueDrafts", () => {
  async function dueTemplate(user = "u", schedule: Parameters<typeof createTemplateFromInvoice>[2] = { frequency: "monthly", startDate: "2026-11-05" }) {
    return createTemplateFromInvoice(user, sourceInvoice(), schedule, { now: NOON("2026-10-20") });
  }

  it("creates exactly one DRAFT with fresh dates, no number, no period-specific fulfillment date", async () => {
    const t = await dueTemplate();
    const res = await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(res).toMatchObject({ created: 1, failed: 0 });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [userId, draft] = mockUpsert.mock.calls[0] as [string, Invoice];
    expect(userId).toBe("u");
    expect(draft).toMatchObject({
      status: "draft",
      invoiceNumber: "",
      documentType: "invoice",
      issueDate: "2026-11-05",
      dueDate: "2026-11-13",
      clientName: "Acme Kft.",
      clientId: "client-1",
      currency: "EUR",
      language: "en",
      paymentMethod: "transfer",
    });
    expect(draft.fulfillmentDate).toBeUndefined();
    expect(draft.exchangeRate).toBeUndefined();
    expect(draft.paidAt).toBeUndefined();
    expect(draft.lineItems[0].id).not.toBe("li-1");
    expect(draft.lineItems[0].description).toBe("Retainer");

    const row = rowsOf(recurringInvoiceTemplate).find((r) => r.id === t.id)!;
    expect(row).toMatchObject({ nextIndex: 1, nextRunDate: "2026-12-05", status: "active" });
    expect(rowsOf(recurringInvoiceRun)).toEqual([
      expect.objectContaining({ templateId: t.id, periodKey: "2026-11-05", invoiceId: draft.id }),
    ]);
  });

  it("notifies the account with a link to the draft (no e-mail path involved)", async () => {
    await dueTemplate();
    await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    const [uid, input] = mockNotify.mock.calls[0];
    expect(uid).toBe("u");
    expect(input.type).toBe("system");
    expect(input.title).toContain("notifications.content.recurringDraftTitle");
    expect(input.title).toContain("Acme Kft.");
    expect(input.href).toMatch(/^\/invoices\/id-/);
  });

  it("does nothing before the run date", async () => {
    await dueTemplate();
    const res = await generateDueDrafts({ now: NOON("2026-11-04") });
    expect(res).toMatchObject({ created: 0, processed: 0 });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run the same day creates no second draft", async () => {
    await dueTemplate();
    await generateDueDrafts({ now: NOON("2026-11-05") });
    const again = await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(again.created).toBe(0);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(rowsOf(recurringInvoiceRun)).toHaveLength(1);
  });

  it("is idempotent under a concurrent/duplicate run: the unique claim wins once", async () => {
    await dueTemplate();
    const [r1, r2] = await Promise.all([
      generateDueDrafts({ now: NOON("2026-11-05") }),
      generateDueDrafts({ now: NOON("2026-11-05") }),
    ]);
    expect(r1.created + r2.created).toBe(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(rowsOf(recurringInvoiceRun)).toHaveLength(1);
  });

  it("heals a template whose period was already claimed (stale pointer) without a duplicate", async () => {
    const t = await dueTemplate();
    mockTables.set(recurringInvoiceRun, [
      { id: "r0", templateId: t.id, userId: "u", periodKey: "2026-11-05", invoiceId: "old-draft" },
    ]);
    const res = await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(rowsOf(recurringInvoiceTemplate)[0]).toMatchObject({ nextIndex: 1, nextRunDate: "2026-12-05" });
  });

  it("catch-up: after missed days creates only the OLDEST period per run, then the next on the next run", async () => {
    await dueTemplate(); // 2026-11-05 monthly
    const first = await generateDueDrafts({ now: NOON("2027-01-20") });
    expect(first.created).toBe(1);
    expect(rowsOf(recurringInvoiceRun).map((r) => r.periodKey)).toEqual(["2026-11-05"]);

    const second = await generateDueDrafts({ now: NOON("2027-01-21") });
    expect(second.created).toBe(1);
    expect(rowsOf(recurringInvoiceRun).map((r) => r.periodKey)).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("uses the Budapest calendar day, not the UTC day, for 'due today'", async () => {
    await createTemplateFromInvoice("u", sourceInvoice(), { frequency: "monthly", startDate: "2026-11-06" }, { now: NOON("2026-10-20") });
    // 2026-11-05 23:30 UTC is already 2026-11-06 00:30 in Budapest (CET, UTC+1).
    const res = await generateDueDrafts({ now: new Date("2026-11-05T23:30:00Z") });
    expect(res.created).toBe(1);
  });

  it("completes the template after the last occurrence", async () => {
    await dueTemplate("u", { frequency: "monthly", startDate: "2026-11-05", maxOccurrences: 1 });
    await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(rowsOf(recurringInvoiceTemplate)[0]).toMatchObject({ status: "completed", nextRunDate: null });
    const res = await generateDueDrafts({ now: NOON("2027-06-05") });
    expect(res.created).toBe(0);
  });

  it("one failing template does not stop the others; the claim is released so it retries", async () => {
    const bad = await dueTemplate("u1");
    await dueTemplate("u2");
    mockUpsert.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const res = await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(res).toMatchObject({ created: 1, failed: 1 });
    expect(res.errors[0]).toContain("db down");
    // claim for the failed one released, pointer unchanged:
    expect(rowsOf(recurringInvoiceRun).some((r) => r.templateId === bad.id)).toBe(false);
    const retry = await generateDueDrafts({ now: NOON("2026-11-06") });
    expect(retry.created).toBe(1);
  });

  it("a notification failure never fails the generation", async () => {
    await dueTemplate();
    mockNotify.mockRejectedValueOnce(new Error("notif down"));
    const res = await generateDueDrafts({ now: NOON("2026-11-05") });
    expect(res).toMatchObject({ created: 1, failed: 0 });
  });

  it("scopes a manual run to one account", async () => {
    await dueTemplate("u1");
    await dueTemplate("u2");
    const res = await generateDueDrafts({ now: NOON("2026-11-05"), userId: "u1" });
    expect(res.created).toBe(1);
    expect(mockUpsert.mock.calls[0][0]).toBe("u1");
  });

  it("never issues: only upsertInvoice with status draft is ever called", async () => {
    await dueTemplate();
    await generateDueDrafts({ now: NOON("2026-11-05") });
    for (const call of mockUpsert.mock.calls) expect((call[1] as Invoice).status).toBe("draft");
  });
});
