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

import { requireSession } from "@/lib/api/session";
import { processPaymentReminders } from "@/lib/reminders/process";
import { GET, POST } from "@/app/api/reminders/run+api";

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
    mockProcess.mockResolvedValue({ processed: 0, sent: 0, errors: [] });
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
    mockProcess.mockResolvedValue({ processed: 0, sent: 0, errors: [] });
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
