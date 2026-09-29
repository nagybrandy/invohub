// __tests__/api/receipts/submit-nav.test.ts
// The manual "report this receipt's day to NAV" route, on the rebuilt
// eRECEIPT client: main's credential hardening + the per-currency reports.
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

const mockValues = jest.fn();
const mockSet = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();

jest.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

jest.mock("@/db/schema", () => ({
  navReceiptSubmission: {
    id: "navReceiptSubmission.id",
    companyId: "navReceiptSubmission.companyId",
    reportDate: "navReceiptSubmission.reportDate",
  },
  receipt: { id: "receipt.id" },
}));

jest.mock("@/lib/receipts/service", () => ({
  getReceiptById: jest.fn(),
  getReceiptsByDateRange: jest.fn(),
  markReceiptsSubmittedForRange: jest.fn(),
}));

jest.mock("@/lib/receipts/daily-report", () => ({
  buildDailyReceiptReports: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "test-id"),
}));

jest.mock("@/lib/nav-receipt/report", () => ({
  submitReceiptDataReport: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import {
  getReceiptById,
  getReceiptsByDateRange,
  markReceiptsSubmittedForRange,
} from "@/lib/receipts/service";
import { buildDailyReceiptReports } from "@/lib/receipts/daily-report";
import { MISSING_EXCHANGE_RATE } from "@/lib/receipts/nav-error-code";
import { getCompanyByUserId } from "@/lib/companies/service";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import { POST } from "@/app/api/receipts/[id]/submit-nav+api";
import { encryptNavSecret } from "@/lib/nav/credentials";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetReceipt = getReceiptById as jest.MockedFunction<typeof getReceiptById>;
const mockGetRange = getReceiptsByDateRange as jest.MockedFunction<typeof getReceiptsByDateRange>;
const mockMark = markReceiptsSubmittedForRange as jest.MockedFunction<typeof markReceiptsSubmittedForRange>;
const mockBuildReports = buildDailyReceiptReports as jest.MockedFunction<typeof buildDailyReceiptReports>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockSubmit = submitReceiptDataReport as jest.MockedFunction<typeof submitReceiptDataReport>;

function makeRequest(id: string) {
  return new Request(`http://localhost/api/receipts/${id}/submit-nav`, {
    method: "POST",
  });
}

const fakeCompany = {
  id: "comp-1",
  userId: "user-1",
  name: "Demo Kft.",
  taxNumber: "12345678-2-41",
  navTechnicalUser: "tech-user",
  navTechnicalPassword: "tech-pass",
  navXmlSignKey: "sign-key",
  navXmlChangeKey: "change-key",
  navReceiptSoftwareId: "InvoHub",
  navEnvironment: "test",
  vatExempt: false,
};

const fakeReceipt = {
  id: "r1",
  receiptNumber: "NYG-001",
  totalAmount: 5000,
  currency: "HUF",
  navSubmitted: false,
  issuedAt: "2026-06-15T10:00:00.000Z",
};

const hufReport = {
  taxPayerId: "12345678",
  issuingSoftwareName: "InvoHub",
  applicableDate: "2026-06-15",
  serialNumber: "NYG-001",
  currency: "HUF",
  exchangeRate: null,
  vatCategoryItems: [{ vat: "27%", saleDocument: 5000, modifyingDocument: 0 }],
  total: 5000,
  numberOfSaleDocument: 2,
  numberOfModifyingDocument: 0,
};

/** Existing nav_receipt_submission rows for the (company, date) the route looks up. */
function dayRows(rows: unknown[]) {
  mockSelect.mockReturnValue({
    from: jest.fn(() => ({ where: jest.fn().mockResolvedValue(rows) })),
  });
}

const insertedRows = () => mockValues.mock.calls.map((call) => call[0]);
const updatedRows = () => mockSet.mock.calls.map((call) => call[0]);

const SAVED_ENV: Record<string, string | undefined> = {};
const ENV_KEYS = ["NAV_CREDENTIALS_KEY", "NAV_CREDENTIALS_KEY_ID", "NAV_CREDENTIALS_PREVIOUS_KEYS", "NAV_PRODUCTION_ENABLED"];

describe("POST /api/receipts/[id]/submit-nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of ENV_KEYS) {
      SAVED_ENV[k] = process.env[k];
      delete process.env[k];
    }
    process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 4).toString("base64");

    mockValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockSet.mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    mockUpdate.mockReturnValue({ set: mockSet });
    dayRows([]);

    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetReceipt.mockResolvedValue(fakeReceipt as never);
    mockGetCompany.mockResolvedValue(fakeCompany as never);
    mockGetRange.mockResolvedValue([
      { ...fakeReceipt, receiptNumber: "NYG-002" } as never,
      fakeReceipt as never,
    ]);
    mockBuildReports.mockReturnValue({ reports: [hufReport as never], blocked: [] });
    mockSubmit.mockResolvedValue({ ok: true, reportId: "12345678_20260615_1" });
    mockMark.mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (SAVED_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = SAVED_ENV[k];
    }
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/receipts//submit-nav", { method: "POST" }),
      {}
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when receipt not found", async () => {
    mockGetReceipt.mockResolvedValue(null);
    const res = await POST(makeRequest("missing"), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 with a stable code when the receipt is already submitted", async () => {
    mockGetReceipt.mockResolvedValue({ ...fakeReceipt, navSubmitted: true } as never);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Already submitted");
    expect(body.code).toBe("receiptAlreadySubmitted");
  });

  it("returns 400 when company profile is missing", async () => {
    mockGetCompany.mockResolvedValue(null);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Company profile");
  });

  describe("demo mode (the default)", () => {
    it("never calls NAV or aggregates the day, and still records an accepted row and flags the receipt", async () => {
      mockGetCompany.mockResolvedValue({
        ...fakeCompany,
        navEnvironment: "demo",
        navTechnicalUser: null,
        navTechnicalPassword: null,
        navXmlSignKey: null,
        taxNumber: null,
      } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ ok: true, mode: "demo", reportDate: "2026-06-15" });
      expect(body.transactionId).toMatch(/^RECEIPT-DEMO-/);
      expect(mockSubmit).not.toHaveBeenCalled();
      expect(mockGetRange).not.toHaveBeenCalled();
      expect(insertedRows()).toHaveLength(1);
      expect(insertedRows()[0]).toMatchObject({ status: "submitted", receiptCount: 1 });
      expect(updatedRows()[0]).toMatchObject({ navSubmitted: true });
    });
  });

  describe("production mode", () => {
    it.each([["off", undefined], ["on", "true"]])(
      "is refused outright with NAV_PRODUCTION_ENABLED %s — there is no verified production eRECEIPT host",
      async (_label, flag) => {
        if (flag) process.env.NAV_PRODUCTION_ENABLED = flag;
        mockGetCompany.mockResolvedValue({ ...fakeCompany, navEnvironment: "production" } as never);

        const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe("navReceiptProductionUnsupported");
        expect(mockSubmit).not.toHaveBeenCalled();
        expect(mockInsert).not.toHaveBeenCalled();
      }
    );
  });

  describe("test mode", () => {
    it("returns 400 when NAV credentials are missing", async () => {
      mockGetCompany.mockResolvedValue({
        ...fakeCompany,
        navTechnicalUser: null,
        navTechnicalPassword: null,
        navXmlSignKey: null,
      } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("NAV credentials");
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("sends the day's HUF report once, records pending → submitted with NAV's id, and flags every HUF receipt of the day", async () => {
      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        mode: "test",
        reportDate: "2026-06-15",
        receiptCount: 2,
        transactionId: "12345678_20260615_1",
      });
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      expect(mockSubmit).toHaveBeenCalledWith(hufReport, expect.anything(), "test");

      expect(insertedRows()).toHaveLength(1);
      expect(insertedRows()[0]).toMatchObject({
        status: "pending",
        receiptCount: 2,
        startReceiptNumber: "NYG-001",
        endReceiptNumber: "NYG-002",
      });
      expect(updatedRows()[0]).toMatchObject({
        status: "submitted",
        transactionId: "12345678_20260615_1",
      });

      // The Budapest calendar day of the receipt, HUF only.
      expect(mockMark).toHaveBeenCalledTimes(1);
      const [userId, start, end, currency] = mockMark.mock.calls[0];
      expect(userId).toBe("user-1");
      expect(start.toISOString()).toBe("2026-06-14T22:00:00.000Z");
      expect(end.toISOString()).toBe("2026-06-15T21:59:59.999Z");
      expect(currency).toBe("HUF");
    });

    it("reports the Budapest day, not the UTC one: a receipt issued at 00:30 local belongs to the new day", async () => {
      mockGetReceipt.mockResolvedValue({ ...fakeReceipt, issuedAt: "2026-06-15T22:30:00.000Z" } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(body.reportDate).toBe("2026-06-16");
      expect(mockBuildReports.mock.calls[0][1]).toMatchObject({ applicableDate: "2026-06-16" });
    });

    it("stores NAV's error text on a rejection and flags nothing", async () => {
      mockSubmit.mockResolvedValue({ ok: false, error: "VALIDATION_ERROR Bad data" });

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(false);
      expect(body.error).toBe("VALIDATION_ERROR Bad data");
      expect(updatedRows()[0]).toMatchObject({ status: "failed", errorMessage: "VALIDATION_ERROR Bad data" });
      expect(mockMark).not.toHaveBeenCalled();
    });

    it("a thrown NAV call still resolves the row to failed — never left pending for the cron to misread", async () => {
      mockSubmit.mockRejectedValue(new Error("NAV timeout"));

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(false);
      expect(insertedRows()[0]).toMatchObject({ status: "pending" });
      expect(updatedRows()[0]).toMatchObject({ status: "failed", errorMessage: "NAV timeout" });
      expect(mockMark).not.toHaveBeenCalled();
    });

    it("refuses a non-HUF receipt: blocked row, no NAV call, nothing flagged", async () => {
      mockGetReceipt.mockResolvedValue({ ...fakeReceipt, currency: "EUR" } as never);
      mockBuildReports.mockReturnValue({
        reports: [],
        blocked: [{ currency: "EUR", reason: "missing_exchange_rate", receiptCount: 1 }],
      });

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(false);
      expect(body.error).toBe(MISSING_EXCHANGE_RATE);
      expect(mockSubmit).not.toHaveBeenCalled();
      expect(insertedRows()).toHaveLength(1);
      expect(insertedRows()[0]).toMatchObject({
        status: "failed",
        receiptCount: 1,
        errorMessage: MISSING_EXCHANGE_RATE,
      });
      expect(mockMark).not.toHaveBeenCalled();
    });

    it("a mixed day asked through its EUR receipt: the HUF report goes out and HUF receipts are flagged, but this receipt is not reported", async () => {
      mockGetReceipt.mockResolvedValue({ ...fakeReceipt, currency: "EUR" } as never);
      mockBuildReports.mockReturnValue({
        reports: [hufReport as never],
        blocked: [{ currency: "EUR", reason: "missing_exchange_rate", receiptCount: 1 }],
      });

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(body.ok).toBe(false);
      expect(body.error).toBe(MISSING_EXCHANGE_RATE);
      expect(mockSubmit).toHaveBeenCalledTimes(1);
      expect(mockMark).toHaveBeenCalledWith("user-1", expect.any(Date), expect.any(Date), "HUF");
      // The asked-for receipt itself is never flagged by id.
      expect(mockUpdate.mock.calls.some(([table]) => (table as { id?: string }).id === "receipt.id")).toBe(false);
    });

    it("keeps one blocked row per day: an existing refusal is refreshed, not duplicated", async () => {
      dayRows([
        { id: "sub-blocked", status: "failed", errorMessage: MISSING_EXCHANGE_RATE, reportDate: "2026-06-15" },
      ]);
      mockGetReceipt.mockResolvedValue({ ...fakeReceipt, currency: "EUR" } as never);
      mockBuildReports.mockReturnValue({
        reports: [],
        blocked: [{ currency: "EUR", reason: "missing_exchange_rate", receiptCount: 3 }],
      });

      await POST(makeRequest("r1"), { params: { id: "r1" } });

      expect(mockInsert).not.toHaveBeenCalled();
      expect(updatedRows()[0]).toMatchObject({ receiptCount: 3 });
    });

    it("does not report a day twice: with a submitted row already there, it flags the HUF receipts and sends nothing", async () => {
      dayRows([{ id: "sub-done", status: "submitted", transactionId: "12345678_20260615_1", reportDate: "2026-06-15" }]);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        alreadyReported: true,
        submissionId: "sub-done",
        transactionId: "12345678_20260615_1",
      });
      expect(mockSubmit).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockMark).toHaveBeenCalledWith("user-1", expect.any(Date), expect.any(Date), "HUF");
    });
  });

  describe("credential handling", () => {
    it("decrypts the sealed password/sign key only for the NAV call", async () => {
      mockGetCompany.mockResolvedValue({
        ...fakeCompany,
        navTechnicalPassword: encryptNavSecret("real-pass"),
        navXmlSignKey: encryptNavSecret("real-sign"),
      } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ technicalPassword: "real-pass", signingKey: "real-sign" }),
        "test"
      );
      expect(JSON.stringify(body)).not.toContain("real-pass");
      expect(JSON.stringify(body)).not.toContain("real-sign");
    });

    it("returns 400 (no NAV call, no row) when the stored secret can't be decrypted", async () => {
      const sealed = encryptNavSecret("real-pass");
      process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 8).toString("base64");
      mockGetCompany.mockResolvedValue({
        ...fakeCompany,
        navTechnicalPassword: sealed,
        navXmlSignKey: sealed,
      } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(JSON.stringify(body)).not.toContain(sealed);
      expect(mockSubmit).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  it("returns 500 with a safe message on an unexpected exception", async () => {
    mockGetReceipt.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB connection lost");
  });
});
