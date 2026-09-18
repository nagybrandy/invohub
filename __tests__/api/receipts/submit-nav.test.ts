jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue([]) });
const mockUpdate = jest.fn().mockReturnValue({
  set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
});

jest.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

jest.mock("@/db/schema", () => ({
  navReceiptSubmission: { id: "navReceiptSubmission.id" },
  receipt: { id: "receipt.id" },
}));

jest.mock("@/lib/receipts/service", () => ({
  getReceiptById: jest.fn(),
  getReceiptsByDateRange: jest.fn(),
}));

jest.mock("@/lib/receipts/daily-report", () => ({
  buildDailyReceiptReports: jest.fn(),
  BLOCKED_EXCHANGE_RATE_MESSAGE_HU:
    "Nem HUF nyugta: hiányzik az árfolyam, ezért nem küldhető be a NAV-nak.",
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "test-id"),
}));

jest.mock("@/lib/nav/credentials", () => ({
  decryptNavSecretOrPassthrough: jest.fn((v: string | null | undefined) => v ?? undefined),
}));

jest.mock("@/lib/nav-receipt/report", () => ({
  submitReceiptDataReport: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { getReceiptById, getReceiptsByDateRange } from "@/lib/receipts/service";
import { buildDailyReceiptReports } from "@/lib/receipts/daily-report";
import { getCompanyByUserId } from "@/lib/companies/service";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import { POST } from "@/app/api/receipts/[id]/submit-nav+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetReceipt = getReceiptById as jest.MockedFunction<typeof getReceiptById>;
const mockGetRange = getReceiptsByDateRange as jest.MockedFunction<typeof getReceiptsByDateRange>;
const mockBuildReports = buildDailyReceiptReports as jest.MockedFunction<typeof buildDailyReceiptReports>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockSubmit = submitReceiptDataReport as jest.MockedFunction<typeof submitReceiptDataReport>;

function makeRequest(id: string) {
  return new Request(`http://localhost/api/receipts/${id}/submit-nav`, {
    method: "POST",
  });
}

const fakeCompanyTest = {
  id: "comp-1",
  userId: "user-1",
  name: "Demo Kft.",
  taxNumber: "12345678-2-41",
  navTechnicalUser: "tech-user",
  navTechnicalPassword: "tech-pass",
  navXmlSignKey: "sign-key",
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
  numberOfSaleDocument: 1,
  numberOfModifyingDocument: 0,
};

describe("POST /api/receipts/[id]/submit-nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });
    mockUpdate.mockReturnValue({
      set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
    });
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetReceipt.mockResolvedValue(fakeReceipt as never);
    mockGetCompany.mockResolvedValue(fakeCompanyTest as never);
    mockGetRange.mockResolvedValue([fakeReceipt as never]);
    mockBuildReports.mockReturnValue({ reports: [hufReport as never], blocked: [] });
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

  it("returns 400 when already submitted", async () => {
    mockGetReceipt.mockResolvedValue({ ...fakeReceipt, navSubmitted: true } as never);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Already submitted");
  });

  it("returns 400 when company profile is missing", async () => {
    mockGetCompany.mockResolvedValue(null);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Company profile");
  });

  it("makes zero fetch calls in demo mode (the default) and still records a submission row", async () => {
    mockGetCompany.mockResolvedValue({
      ...fakeCompanyTest,
      navEnvironment: "demo",
      navTechnicalUser: null,
      navTechnicalPassword: null,
      navXmlSignKey: null,
    } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("demo");
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockGetRange).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when NAV credentials missing in test mode", async () => {
    mockGetCompany.mockResolvedValue({
      ...fakeCompanyTest,
      navTechnicalUser: null,
      navTechnicalPassword: null,
      navXmlSignKey: null,
    } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("NAV credentials");
  });

  it("in test mode calls submitReceiptDataReport once per reportable currency group and stores the NAV id", async () => {
    mockSubmit.mockResolvedValue({ ok: true, reportId: "12345678_20260615_1" } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedValues = mockInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.transactionId).toBe("12345678_20260615_1");
    expect(insertedValues.status).toBe("submitted");
  });

  it("stores NAV's error text in errorMessage on a NAV rejection", async () => {
    mockSubmit.mockResolvedValue({ ok: false, error: "VALIDATION_ERROR Bad data" } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    const insertedValues = mockInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.status).toBe("failed");
    expect(insertedValues.errorMessage).toBe("VALIDATION_ERROR Bad data");
  });

  it("stores the blocked-group message in errorMessage for a non-HUF group, with no fetch call", async () => {
    mockBuildReports.mockReturnValue({
      reports: [],
      blocked: [{ currency: "EUR", reason: "missing_exchange_rate", receiptCount: 1 }],
    });

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(mockSubmit).not.toHaveBeenCalled();
    const insertedValues = mockInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.status).toBe("failed");
    expect(insertedValues.errorMessage).toContain("HUF");
  });

  it("returns 500 on unexpected exception", async () => {
    mockGetReceipt.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB connection lost");
  });
});
