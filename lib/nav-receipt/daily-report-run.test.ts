// lib/nav-receipt/daily-report-run.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/db/schema", () => ({
  company: { navTechnicalUser: "company.navTechnicalUser" },
  navReceiptSubmission: {
    id: "navReceiptSubmission.id",
    companyId: "navReceiptSubmission.companyId",
  },
}));

jest.mock("@/lib/id", () => ({ createId: jest.fn(() => "sub-new") }));
jest.mock("@/lib/nav-receipt/report", () => ({ submitReceiptDataReport: jest.fn() }));
jest.mock("@/lib/nav/credentials", () => ({
  decryptNavSecretOrPassthrough: jest.fn((v: string | null | undefined) => v ?? undefined),
}));
jest.mock("@/lib/receipts/service", () => ({
  getReceiptsByDateRange: jest.fn(),
  markReceiptsSubmittedForRange: jest.fn(),
}));

import { runDailyReceiptReports } from "@/lib/nav-receipt/daily-report-run";
import { decryptNavSecretOrPassthrough } from "@/lib/nav/credentials";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import { BLOCKED_EXCHANGE_RATE_MESSAGE_HU } from "@/lib/receipts/daily-report";
import {
  getReceiptsByDateRange,
  markReceiptsSubmittedForRange,
} from "@/lib/receipts/service";

const { db } = jest.requireMock("@/db");

const mockDecrypt = decryptNavSecretOrPassthrough as jest.MockedFunction<
  typeof decryptNavSecretOrPassthrough
>;

const mockSubmit = submitReceiptDataReport as jest.MockedFunction<
  typeof submitReceiptDataReport
>;
const mockRange = getReceiptsByDateRange as jest.MockedFunction<
  typeof getReceiptsByDateRange
>;
const mockMark = markReceiptsSubmittedForRange as jest.MockedFunction<
  typeof markReceiptsSubmittedForRange
>;

// 2026-07-08T06:00:00Z = 08:00 Europe/Budapest (CEST) on 2026-07-08.
const NOW = new Date("2026-07-08T06:00:00.000Z");

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: "comp-1",
    userId: "user-1",
    navTechnicalUser: "tech-user",
    navTechnicalPassword: "pw",
    navXmlSignKey: "sign-key",
    taxNumber: "12345678-1-23",
    navEnvironment: "test",
    navReceiptSoftwareId: null,
    ...overrides,
  };
}

function companiesSelect(companies: unknown[]) {
  return { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(companies) }) };
}

function submissionsSelect(rows: unknown[]) {
  return { from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(rows) }) };
}

// The day's receipts as lib/receipts/service returns them; the real
// buildDailyReceiptReports groups them per currency.
function dayReceipt(receiptNumber: string, currency: "HUF" | "EUR" = "HUF") {
  return {
    id: `id-${receiptNumber}`,
    receiptNumber,
    currency,
    lineItems: [{ vatRate: 27, quantity: 1, unitPrice: 500 }],
  } as never;
}

const hufDay = [dayReceipt("NYG-002"), dayReceipt("NYG-001")];

describe("runDailyReceiptReports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
    });
    mockRange.mockResolvedValue(hufDay);
    mockMark.mockResolvedValue(undefined);
    mockSubmit.mockResolvedValue({ ok: true, reportId: "TX-1" });
  });

  it("processes exactly 3 Europe/Budapest calendar dates, oldest first (AC1)", async () => {
    db.select.mockReturnValueOnce(companiesSelect([]));

    const result = await runDailyReceiptReports({ now: NOW });

    expect(result.reportDates).toEqual(["2026-07-05", "2026-07-06", "2026-07-07"]);
    expect(result.windowDays).toBe(3);
    expect(result.ok).toBe(true);
  });

  it("already_submitted: no NAV call, no insert for that pair (AC2)", async () => {
    const submittedRow = {
      id: "sub-1",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "submitted",
      attemptCount: 1,
      updatedAt: new Date("2026-07-07T05:00:00.000Z"),
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([submittedRow]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results).toEqual([
      { companyId: "comp-1", reportDate: "2026-07-07", status: "already_submitted" },
    ]);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("already_submitted: a newer failed row does not hide an older submitted row for the same pair — no re-send (regression)", async () => {
    const olderSubmittedRow = {
      id: "sub-old",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "submitted",
      attemptCount: 1,
      updatedAt: new Date("2026-07-07T05:00:00.000Z"),
    };
    // A later manual submit (app/api/receipts/[id]/submit-nav+api.ts) can
    // legitimately write a second row for the same (companyId, reportDate)
    // that ends up "failed" and newer than the "submitted" row — there is
    // deliberately no unique DB constraint preventing this.
    const newerFailedRow = {
      id: "sub-new",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "failed",
      attemptCount: 1,
      updatedAt: new Date("2026-07-07T08:00:00.000Z"),
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([olderSubmittedRow, newerFailedRow]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results).toEqual([
      { companyId: "comp-1", reportDate: "2026-07-07", status: "already_submitted" },
    ]);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("failed row is retried in place: update not insert, attemptCount incremented (AC3)", async () => {
    const failedRow = {
      id: "sub-1",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "failed",
      attemptCount: 2,
      updatedAt: new Date("2026-07-07T05:00:00.000Z"),
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([failedRow]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
    expect(result.results[0]).toMatchObject({
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "submitted",
      attemptCount: 3,
    });
  });

  it("a recent pending row yields in_flight with no NAV call and no write (AC4)", async () => {
    const recentPending = {
      id: "sub-1",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "pending",
      attemptCount: 1,
      updatedAt: new Date(NOW.getTime() - 5 * 60 * 1000), // 5 minutes ago
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([recentPending]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results).toEqual([
      { companyId: "comp-1", reportDate: "2026-07-07", status: "in_flight" },
    ]);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("a stale (>=15min) pending row is retried in place exactly as a failed row (AC4)", async () => {
    const stalePending = {
      id: "sub-1",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "pending",
      attemptCount: 1,
      updatedAt: new Date(NOW.getTime() - 15 * 60 * 1000), // exactly 15 minutes ago
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([stalePending]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
    expect(result.results[0]).toMatchObject({ status: "submitted", attemptCount: 2 });
  });

  it("writes a rejected submission to failed with the error message, and still processes the next company (AC5)", async () => {
    mockSubmit.mockReset();
    mockSubmit.mockRejectedValueOnce(new Error("NAV timeout"));
    mockSubmit.mockResolvedValueOnce({ ok: true, reportId: "TX-2" });

    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany({ id: "comp-a" }), makeCompany({ id: "comp-b" })]))
      .mockReturnValueOnce(submissionsSelect([]))
      .mockReturnValueOnce(submissionsSelect([]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    const failedEntry = result.results.find((r) => r.companyId === "comp-a");
    const okEntry = result.results.find((r) => r.companyId === "comp-b");

    expect(failedEntry).toMatchObject({ status: "failed", error: "NAV timeout" });
    expect(okEntry).toMatchObject({ status: "submitted" });
    // The failed row must be written to "failed", never left "pending".
    const failedUpdateCalls = (db.update as jest.Mock).mock.results.map((r) => r.value);
    expect(failedUpdateCalls.length).toBeGreaterThan(0);
  });

  it("a decryption failure resolves the row to failed and still processes the remaining companies (regression, AC5)", async () => {
    mockDecrypt.mockImplementationOnce(() => {
      throw new Error("NAV_CREDENTIALS_KEY nincs beállítva.");
    });

    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany({ id: "comp-a" }), makeCompany({ id: "comp-b" })]))
      .mockReturnValueOnce(submissionsSelect([]))
      .mockReturnValueOnce(submissionsSelect([]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    const failedEntry = result.results.find((r) => r.companyId === "comp-a");
    const okEntry = result.results.find((r) => r.companyId === "comp-b");

    expect(failedEntry).toMatchObject({
      status: "failed",
      error: "NAV_CREDENTIALS_KEY nincs beállítva.",
    });
    expect(okEntry).toMatchObject({ status: "submitted" });
    // The row must never be left "pending", and submitReceiptDataReport
    // must never be called for the company whose credentials failed to
    // decrypt.
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const failedRowUpdate = (db.update as jest.Mock).mock.calls.length;
    expect(failedRowUpdate).toBeGreaterThan(0);
  });

  it("a DB write failure right after a successful NAV submission does not get miscoded as failed (regression)", async () => {
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    // There is no existing row for this (companyId, reportDate), so the
    // pre-NAV-call write is a db.insert (already mocked to succeed in
    // beforeEach); the only db.update call is the post-success write that
    // records the NAV result, which fails here (e.g. a transient DB
    // connection drop unrelated to NAV).
    db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error("connection terminated")),
      }),
    });

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    // NAV already accepted the report (mockSubmit resolves ok:true by
    // default) — the row must be reported as submitted, carrying the real
    // transactionId, never silently downgraded to "failed" (which would
    // make the next run's retry-in-place re-send an already-accepted
    // report to NAV).
    expect(result.results[0]).toMatchObject({
      status: "submitted",
      transactionId: "TX-1",
    });
    expect(result.failed).toBe(0);
    expect(result.submitted).toBe(1);
    // markReceiptsSubmittedForRange must not run off a write that never
    // actually recorded "submitted".
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("skips a date with zero receipts (no insert), and flags demo/missing-credential companies (AC6)", async () => {
    mockRange.mockResolvedValueOnce([]);

    db.select
      .mockReturnValueOnce(
        companiesSelect([
          makeCompany({ id: "comp-demo", navEnvironment: "demo" }),
          makeCompany({ id: "comp-nocreds", navEnvironment: "test", taxNumber: null }),
          makeCompany({ id: "comp-zero" }),
        ])
      )
      .mockReturnValueOnce(submissionsSelect([]))
      .mockReturnValueOnce(submissionsSelect([]))
      .mockReturnValueOnce(submissionsSelect([]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results.find((r) => r.companyId === "comp-demo")).toMatchObject({
      status: "missing_credentials",
    });
    expect(result.results.find((r) => r.companyId === "comp-nocreds")).toMatchObject({
      status: "missing_credentials",
    });
    expect(result.results.find((r) => r.companyId === "comp-zero")).toMatchObject({
      status: "skipped_no_receipts",
    });
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("marks receipts submitted on success, and never on failure (AC8)", async () => {
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(mockMark).toHaveBeenCalledTimes(1);
    const [, start, end, currency] = mockMark.mock.calls[0];
    expect(start.toISOString()).toBe("2026-07-06T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-07T21:59:59.999Z");
    // Only what was reported: the day's non-HUF receipts must not read as submitted.
    expect(currency).toBe("HUF");

    mockMark.mockClear();
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValueOnce({ ok: false, error: "rejected" });
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("only ever calls the NAV test environment; a production company is refused without a call or a row (AC11)", async () => {
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany({ navEnvironment: "production" })]))
      .mockReturnValueOnce(submissionsSelect([]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results).toEqual([
      { companyId: "comp-1", reportDate: "2026-07-07", status: "production_not_supported" },
    ]);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();

    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany({ navEnvironment: "test" })]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });
    expect(mockSubmit).toHaveBeenCalledWith(expect.anything(), expect.anything(), "test");
  });

  it("sends one HUF report built from the day's receipts, with the first and last number on the row", async () => {
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    const report = mockSubmit.mock.calls[0][0];
    expect(report).toMatchObject({
      currency: "HUF",
      applicableDate: "2026-07-07",
      serialNumber: "NYG-001",
      numberOfSaleDocument: 2,
      total: 1270,
    });
    const inserted = (db.insert as jest.Mock).mock.results[0].value.values.mock.calls[0][0];
    expect(inserted).toMatchObject({
      status: "pending",
      receiptCount: 2,
      startReceiptNumber: "NYG-001",
      endReceiptNumber: "NYG-002",
    });
  });

  it("a day with HUF and EUR receipts: the HUF report goes out, the EUR group is recorded as blocked", async () => {
    mockRange.mockResolvedValueOnce([dayReceipt("NYG-001"), dayReceipt("NYG-002", "EUR")]);
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results.map((r) => r.status)).toEqual(["blocked_missing_exchange_rate", "submitted"]);
    expect(result.blocked).toBe(1);
    expect(result.submitted).toBe(1);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockSubmit.mock.calls[0][0]).toMatchObject({ currency: "HUF", numberOfSaleDocument: 1 });
    // db.insert returns one shared { values } mock — its calls are the rows, in order.
    const inserts = (db.insert as jest.Mock).mock.results[0].value.values.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(inserts[0]).toMatchObject({
      status: "failed",
      receiptCount: 1,
      errorMessage: BLOCKED_EXCHANGE_RATE_MESSAGE_HU,
    });
    expect(inserts[1]).toMatchObject({ status: "pending", receiptCount: 1 });
  });

  it("an EUR-only day sends nothing and keeps ONE blocked row across the three nightly visits", async () => {
    mockRange.mockResolvedValue([dayReceipt("NYG-001", "EUR")]);
    const blockedRow = {
      id: "sub-blocked",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "failed",
      attemptCount: 0,
      errorMessage: BLOCKED_EXCHANGE_RATE_MESSAGE_HU,
      updatedAt: new Date("2026-07-07T05:00:00.000Z"),
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([blockedRow]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(result.results).toEqual([
      {
        companyId: "comp-1",
        reportDate: "2026-07-07",
        status: "blocked_missing_exchange_rate",
        error: BLOCKED_EXCHANGE_RATE_MESSAGE_HU,
      },
    ]);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled(); // refreshed in place, not duplicated
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("a blocked row is never taken for the HUF row: the HUF report gets its own row, not a retry of the refusal", async () => {
    mockRange.mockResolvedValueOnce([dayReceipt("NYG-001"), dayReceipt("NYG-002", "EUR")]);
    const blockedRow = {
      id: "sub-blocked",
      companyId: "comp-1",
      reportDate: "2026-07-07",
      status: "failed",
      attemptCount: 0,
      errorMessage: BLOCKED_EXCHANGE_RATE_MESSAGE_HU,
      updatedAt: new Date("2026-07-07T05:00:00.000Z"),
    };
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([blockedRow]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    const submittedEntry = result.results.find((r) => r.status === "submitted");
    expect(submittedEntry).toMatchObject({ attemptCount: 1, transactionId: "TX-1" });
    const inserted = (db.insert as jest.Mock).mock.results[0].value.values.mock.calls[0][0];
    expect(inserted).toMatchObject({ id: "sub-new", status: "pending" });
  });

  it("stops at maxSubmissions and reports truncated: true, leaving the rest untouched (AC12)", async () => {
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    const result = await runDailyReceiptReports({ now: NOW, backfillDays: 3, maxSubmissions: 1 });

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(result.truncated).toBe(true);
  });
});
