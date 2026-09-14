// __tests__/api/cron/nav-receipt-report.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    }),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/db/schema", () => ({
  company: { navTechnicalUser: "company.navTechnicalUser" },
  navReceiptSubmission: { id: "navReceiptSubmission.id" },
}));

jest.mock("@/lib/id", () => ({ createId: jest.fn(() => "sub-1") }));
jest.mock("@/lib/nav-receipt/report", () => ({ submitDailyReceiptReport: jest.fn() }));
jest.mock("@/lib/receipts/service", () => ({ getDailyVatAggregation: jest.fn() }));

import { GET } from "@/app/api/cron/nav-receipt-report+api";

const ORIGINAL_ENV = process.env;

function makeRequest(headers?: Record<string, string>) {
  return new Request("http://localhost/api/cron/nav-receipt-report", { headers });
}

describe("GET /api/cron/nav-receipt-report", () => {
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

  it("runs the report when the bearer token matches CRON_SECRET", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.companiesProcessed).toBe(0);
  });
});
