// __tests__/api/cron/nav-receipt-report.test.ts
const mockSelectWhere = jest.fn().mockResolvedValue([]);
let insertedRows: any[] = [];
const mockInsert = jest.fn().mockImplementation(() => ({
  values: (row: unknown) => {
    insertedRows.push(row);
    return Promise.resolve([]);
  },
}));

jest.mock("@/db", () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: (...args: unknown[]) => mockSelectWhere(...args),
      }),
    }),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: jest.fn(),
  },
}));

jest.mock("@/db/schema", () => ({
  company: { navEnvironment: "company.navEnvironment" },
  navReceiptSubmission: { id: "navReceiptSubmission.id" },
}));

jest.mock("@/lib/id", () => ({ createId: jest.fn(() => "sub-1") }));
jest.mock("@/lib/nav/credentials", () => ({
  decryptNavSecretOrPassthrough: jest.fn((v: string | null | undefined) => v ?? undefined),
}));
jest.mock("@/lib/nav-receipt/report", () => ({ submitReceiptDataReport: jest.fn() }));
jest.mock("@/lib/receipts/service", () => ({ getReceiptsByDateRange: jest.fn() }));

import { GET } from "@/app/api/cron/nav-receipt-report+api";
import { submitReceiptDataReport } from "@/lib/nav-receipt/report";
import { getReceiptsByDateRange } from "@/lib/receipts/service";

const mockSubmit = submitReceiptDataReport as jest.MockedFunction<typeof submitReceiptDataReport>;
const mockGetRange = getReceiptsByDateRange as jest.MockedFunction<typeof getReceiptsByDateRange>;

const ORIGINAL_ENV = process.env;

function makeRequest(headers?: Record<string, string>) {
  return new Request("http://localhost/api/cron/nav-receipt-report", { headers });
}

const testCompany = {
  id: "comp-1",
  userId: "user-1",
  taxNumber: "12345678",
  navTechnicalUser: "tech-user",
  navTechnicalPassword: "tech-pass",
  navXmlSignKey: "sign-key",
  navReceiptSoftwareId: "InvoHub",
  navEnvironment: "test",
  vatExempt: false,
};

describe("GET /api/cron/nav-receipt-report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedRows = [];
    mockSelectWhere.mockResolvedValue([]);
    mockInsert.mockImplementation(() => ({
      values: (row: unknown) => {
        insertedRows.push(row);
        return Promise.resolve([]);
      },
    }));
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects every request when CRON_SECRET is not configured (fail closed)", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "" };
    const res = await GET(makeRequest({ authorization: "Bearer anything" }));
    expect(res.status).toBe(401);
  });

  it("rejects a request with no Authorization header even when CRON_SECRET is set", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong bearer token", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("runs the report when the bearer token matches CRON_SECRET, skipping demo companies by construction", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.companiesProcessed).toBe(0);
  });

  it("writes a submitted row for a HUF day and a failed row carrying the missing-exchange-rate message for a EUR day", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    mockSelectWhere.mockResolvedValue([testCompany]);
    mockGetRange.mockResolvedValue([
      {
        receiptNumber: "NYG-001",
        currency: "HUF",
        lineItems: [{ vatRate: 27, quantity: 1, unitPrice: 1000 }],
      },
      {
        receiptNumber: "NYG-002",
        currency: "EUR",
        lineItems: [{ vatRate: 27, quantity: 1, unitPrice: 10 }],
      },
    ] as never);
    mockSubmit.mockResolvedValue({ ok: true, reportId: "12345678_20260101_1" } as never);

    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.companiesProcessed).toBe(1);
    expect(mockSubmit).toHaveBeenCalledTimes(1); // only the HUF group is submitted
    expect(insertedRows).toHaveLength(2);

    const submittedRow = insertedRows.find((row) => row.status === "submitted");
    const failedRow = insertedRows.find((row) => row.status === "failed");

    expect(submittedRow?.transactionId).toBe("12345678_20260101_1");
    expect(failedRow?.errorMessage).toContain("HUF");
  });

  it("skips a test company with missing NAV credentials", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    mockSelectWhere.mockResolvedValue([{ ...testCompany, navTechnicalUser: null }]);

    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results[0].status).toBe("missing_credentials");
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
