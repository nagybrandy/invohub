// __tests__/api/reminders/run.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/reminders/process", () => ({
  processPaymentReminders: jest.fn(),
}));

jest.mock("@/lib/recurring/service", () => ({
  generateDueDrafts: jest.fn(),
}));

import { generateDueDrafts } from "@/lib/recurring/service";
import { requireSession } from "@/lib/api/session";
import { processPaymentReminders } from "@/lib/reminders/process";
import { GET, POST } from "@/app/api/reminders/run+api";

const mockRecurring = generateDueDrafts as jest.MockedFunction<typeof generateDueDrafts>;
const EMPTY_RECURRING = { processed: 0, created: 0, skipped: 0, failed: 0, errors: [] };
const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockProcess = processPaymentReminders as jest.MockedFunction<typeof processPaymentReminders>;

function makeRequest(headers?: Record<string, string>) {
  return new Request("http://localhost/api/reminders/run", {
    method: "GET",
    headers,
  });
}

const ORIGINAL_ENV = process.env;

describe("GET /api/reminders/run (Vercel cron)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-secret" };
    mockProcess.mockResolvedValue({ processed: 0, sent: 0, failed: 0, errors: [] });
    mockRecurring.mockResolvedValue(EMPTY_RECURRING);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("rejects a same-length wrong token and a longer/shorter one (constant-time compare)", async () => {
    expect((await GET(makeRequest({ authorization: "Bearer test-secreT" }))).status).toBe(401);
    expect((await GET(makeRequest({ authorization: "Bearer test-secret-and-more" }))).status).toBe(401);
    expect((await GET(makeRequest({ authorization: "Bearer test" }))).status).toBe(401);
    expect((await GET(makeRequest({ authorization: "Bearer test-secret" }))).status).toBe(200);
  });

  it("rejects every request when CRON_SECRET is not configured (fail closed)", async () => {
    process.env.CRON_SECRET = "";
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("runs reminders for all users when the bearer token matches CRON_SECRET", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    expect(mockProcess).toHaveBeenCalledWith();
    expect(mockSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/reminders/run (manual trigger)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-secret" };
    mockProcess.mockResolvedValue({ processed: 0, sent: 0, failed: 0, errors: [] });
    mockRecurring.mockResolvedValue(EMPTY_RECURRING);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("still accepts the cron bearer token", async () => {
    const res = await POST(
      new Request("http://localhost/api/reminders/run", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      })
    );
    expect(res.status).toBe(200);
    expect(mockProcess).toHaveBeenCalledWith();
  });

  it("falls back to session auth and scopes to that user", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const res = await POST(new Request("http://localhost/api/reminders/run", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(mockProcess).toHaveBeenCalledWith("user-1");
  });

  it("returns 401 without a session or valid cron token", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(new Request("http://localhost/api/reminders/run", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });
});

describe("GET /api/reminders/run — when the run itself breaks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-secret" };
    mockRecurring.mockResolvedValue(EMPTY_RECURRING);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("answers 500 with the reason instead of an unhandled rejection, so cron retries", async () => {
    mockProcess.mockRejectedValue(new Error("Neon: too many connections"));

    const response = await GET(makeRequest({ authorization: "Bearer test-secret" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("too many connections"),
    });
  });

  it("reports a run that finished with per-item failures as 200 with the counts", async () => {
    // A permanently bad recipient must not turn every nightly run into a
    // failed cron job — the counts carry the signal instead.
    mockProcess.mockResolvedValue({
      processed: 3,
      sent: 2,
      failed: 1,
      errors: ["Reminder for invoice INV-1 was refused: 550 mailbox unavailable"],
    });

    const response = await GET(makeRequest({ authorization: "Bearer test-secret" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ processed: 3, sent: 2, failed: 1 });
  });
});

describe("recurring-invoice draft generation rides on the same daily cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: "test-secret" };
    mockProcess.mockResolvedValue({ processed: 1, sent: 1, failed: 0, errors: [] });
    mockRecurring.mockResolvedValue({ processed: 2, created: 2, skipped: 0, failed: 0, errors: [] });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("runs both and reports both results in one JSON body", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    expect(mockRecurring).toHaveBeenCalledWith();
    await expect(res.json()).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      recurring: { created: 2 },
    });
  });

  it("does not run for an unauthorized request", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockRecurring).not.toHaveBeenCalled();
  });

  it("a failing recurring run cannot break the reminders result (200, error reported)", async () => {
    mockRecurring.mockRejectedValue(new Error("recurring boom"));
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      sent: 1,
      recurring: { error: expect.stringContaining("recurring boom") },
    });
  });

  it("a failing reminders run cannot stop recurring drafts (500 for the retry, recurring still reported)", async () => {
    mockProcess.mockRejectedValue(new Error("smtp boom"));
    const res = await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(500);
    expect(mockRecurring).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("smtp boom"),
      recurring: { created: 2 },
    });
  });

  it("the cron-token POST runs both; a signed-in user's manual POST only sends reminders", async () => {
    await POST(
      new Request("http://localhost/api/reminders/run", { method: "POST", headers: { authorization: "Bearer test-secret" } })
    );
    expect(mockRecurring).toHaveBeenCalledTimes(1);

    mockRecurring.mockClear();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    await POST(new Request("http://localhost/api/reminders/run", { method: "POST" }));
    expect(mockRecurring).not.toHaveBeenCalled();
  });
});
