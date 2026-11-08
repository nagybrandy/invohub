// Route wiring tests live in lib/ — a *.test.ts under app/ would be treated as a route by Expo Router.
const mockWithCronRunLog = jest.fn((_job: string, handler: () => Promise<Response>) => handler());
const mockGetCronHealth = jest.fn();

jest.mock("@/lib/observability/cron-run", () => ({
  summarizeReminders: jest.fn(),
  summarizeNavReceipt: jest.fn(),
  withCronRunLog: (...args: [string, () => Promise<Response>]) => mockWithCronRunLog(...args),
  getCronHealth: () => mockGetCronHealth(),
}));
jest.mock("@/lib/reminders/process", () => ({
  processPaymentReminders: jest.fn().mockResolvedValue({ processed: 0, sent: 0, failed: 0, errors: [] }),
}));
jest.mock("@/lib/nav-receipt/daily-report-run", () => ({
  runDailyReceiptReports: jest.fn().mockResolvedValue({ ok: true, failed: 0 }),
}));
jest.mock("@/lib/api/session", () => ({
  jsonResponse: (b: unknown, s = 200) => Response.json(b, { status: s }),
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

import { GET as healthGet } from "../../app/api/health+api";
import { GET as navGet } from "../../app/api/cron/nav-receipt-report+api";
import { GET as remindersGet } from "../../app/api/reminders/run+api";

const authed = () => new Request("http://x/", { headers: { authorization: "Bearer s3cret" } });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
});

describe("cron wiring", () => {
  it("reminders cron GET is logged under 'reminders'", async () => {
    const res = await remindersGet(authed());
    expect(res.status).toBe(200);
    expect(mockWithCronRunLog.mock.calls[0][0]).toBe("reminders");
  });
  it("nav cron GET is logged under 'nav-receipt-report'", async () => {
    const res = await navGet(authed());
    expect(res.status).toBe(200);
    expect(mockWithCronRunLog.mock.calls[0][0]).toBe("nav-receipt-report");
  });
  it("unauthorized requests are not logged", async () => {
    expect((await remindersGet(new Request("http://x/"))).status).toBe(401);
    expect((await navGet(new Request("http://x/"))).status).toBe(401);
    expect(mockWithCronRunLog).not.toHaveBeenCalled();
  });
});

describe("GET /api/health", () => {
  it("includes the cron summary", async () => {
    const crons = { reminders: { lastSuccessAt: "2026-11-08T09:00:00.000Z", lastRunAt: "2026-11-08T09:00:00.000Z", lastStatus: "success" } };
    mockGetCronHealth.mockResolvedValue(crons);
    const body = await (await healthGet()).json();
    expect(body).toMatchObject({ ok: true, service: "invohub", crons });
  });
  it("stays 200 with crons:null when the lookup fails", async () => {
    mockGetCronHealth.mockResolvedValue(null);
    const res = await healthGet();
    expect(res.status).toBe(200);
    expect((await res.json()).crons).toBeNull();
  });
  it("stays 200 even if the lookup throws", async () => {
    mockGetCronHealth.mockRejectedValue(new Error("x"));
    const res = await healthGet();
    expect(res.status).toBe(200);
    expect((await res.json()).crons).toBeNull();
  });
});
