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
jest.mock("@/lib/nav-receipt/report", () => ({ submitDailyReceiptReport: jest.fn() }));
jest.mock("@/lib/nav/credentials", () => ({
  decryptNavSecretOrPassthrough: (v: string | null | undefined) => v ?? undefined,
}));
jest.mock("@/lib/receipts/service", () => ({
  getVatAggregationForRange: jest.fn(),
  markReceiptsSubmittedForRange: jest.fn(),
}));

import { runDailyReceiptReports } from "@/lib/nav-receipt/daily-report-run";
import { submitDailyReceiptReport } from "@/lib/nav-receipt/report";
import {
  getVatAggregationForRange,
  markReceiptsSubmittedForRange,
} from "@/lib/receipts/service";

const { db } = jest.requireMock("@/db");

const mockSubmit = submitDailyReceiptReport as jest.MockedFunction<
  typeof submitDailyReceiptReport
>;
const mockAgg = getVatAggregationForRange as jest.MockedFunction<
  typeof getVatAggregationForRange
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

const aggregationWithReceipts = {
  reportDate: "unused",
  receiptCount: 2,
  startReceiptNumber: "NYG-001",
  endReceiptNumber: "NYG-002",
  vatBreakdown: [
    { vatRate: 27, netAmount: 1000, vatAmount: 270, grossAmount: 1270, itemCount: 2 },
  ],
};

const emptyAggregation = {
  reportDate: "unused",
  receiptCount: 0,
  startReceiptNumber: null,
  endReceiptNumber: null,
  vatBreakdown: [],
};

describe("runDailyReceiptReports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
    });
    mockAgg.mockResolvedValue(aggregationWithReceipts);
    mockMark.mockResolvedValue(undefined);
    mockSubmit.mockResolvedValue({ ok: true, transactionId: "TX-1" });
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
    mockSubmit.mockResolvedValueOnce({ ok: true, transactionId: "TX-2" });

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

  it("skips a date with zero receipts (no insert), and flags demo/missing-credential companies (AC6)", async () => {
    mockAgg.mockResolvedValueOnce(emptyAggregation);

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
    const [, start, end] = mockMark.mock.calls[0];
    expect(start.toISOString()).toBe("2026-07-06T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-07T21:59:59.999Z");

    mockMark.mockClear();
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValueOnce({ ok: false, error: "rejected" });
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany()]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });
    expect(mockMark).not.toHaveBeenCalled();
  });

  it("maps navEnvironment to the NAV environment used for the call (AC11)", async () => {
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany({ navEnvironment: "production" })]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });

    expect(mockSubmit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "production"
    );

    mockSubmit.mockClear();
    db.select
      .mockReturnValueOnce(companiesSelect([makeCompany({ navEnvironment: "test" })]))
      .mockReturnValueOnce(submissionsSelect([]));

    await runDailyReceiptReports({ now: NOW, backfillDays: 1 });
    expect(mockSubmit).toHaveBeenCalledWith(expect.anything(), expect.anything(), "test");
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
