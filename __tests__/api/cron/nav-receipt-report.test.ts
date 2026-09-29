// __tests__/api/cron/nav-receipt-report.test.ts
jest.mock("@/lib/nav-receipt/daily-report-run", () => ({
  runDailyReceiptReports: jest.fn(),
}));

import { GET } from "@/app/api/cron/nav-receipt-report+api";
import { runDailyReceiptReports } from "@/lib/nav-receipt/daily-report-run";

const mockRun = runDailyReceiptReports as jest.MockedFunction<typeof runDailyReceiptReports>;

const ORIGINAL_ENV = process.env;

const RUN_RESULT = {
  ok: true as const,
  windowDays: 3,
  reportDates: ["2026-07-05", "2026-07-06", "2026-07-07"],
  companiesProcessed: 0,
  submitted: 0,
  failed: 0,
  skipped: 0,
  truncated: false,
  results: [],
};

function makeRequest(headers?: Record<string, string>) {
  return new Request("http://localhost/api/cron/nav-receipt-report", { headers });
}

describe("GET /api/cron/nav-receipt-report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockResolvedValue(RUN_RESULT);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects every request when CRON_SECRET is not configured (fail closed)", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "" };
    const res = await GET(makeRequest({ authorization: "Bearer anything" }));
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("rejects a request with no Authorization header even when CRON_SECRET is set", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("runs the report when the bearer token matches CRON_SECRET", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.companiesProcessed).toBe(0);
  });

  it("delegates to runDailyReceiptReports and returns its summary verbatim", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    expect(mockRun).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toEqual(RUN_RESULT);
  });

  it("response contains reportDates with 3 entries and windowDays: 3", async () => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "s3cret" };
    const res = await GET(makeRequest({ authorization: "Bearer s3cret" }));
    const body = await res.json();
    expect(body.windowDays).toBe(3);
    expect(body.reportDates).toHaveLength(3);
  });
});
