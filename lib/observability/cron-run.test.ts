const mockInsertValues = jest.fn();
const mockUpdateWhere = jest.fn();
const mockSelectLimit = jest.fn();

jest.mock("@/db", () => ({
  db: {
    insert: jest.fn(() => ({ values: mockInsertValues })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: mockUpdateWhere })) })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({ orderBy: jest.fn(() => ({ limit: mockSelectLimit })), limit: mockSelectLimit })),
      })),
    })),
  },
}));
jest.mock("@/db/schema", () => ({
  cronRun: { job: "job", startedAt: "startedAt", alertSentAt: "alertSentAt", id: "id" },
}));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn() }));
jest.mock("@/lib/observability/report-error", () => ({
  ...jest.requireActual("@/lib/observability/report-error"),
  reportError: jest.fn(),
}));

import { sendEmail } from "@/lib/email/send";
import { getCronHealth, summarizeNavReceipt, summarizeReminders, withCronRunLog } from "@/lib/observability/cron-run";

const mockSend = sendEmail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertValues.mockResolvedValue(undefined);
  mockUpdateWhere.mockResolvedValue(undefined);
  mockSelectLimit.mockResolvedValue([]);
  mockSend.mockResolvedValue({ ok: true });
  delete process.env.OPS_ALERT_EMAIL;
});

describe("summarizers", () => {
  it("reminders: failed items => partial", () => {
    expect(summarizeReminders({ processed: 3, sent: 2, failed: 1, errors: ["a@b.hu bounced"] })).toEqual({
      status: "partial",
      counts: { processed: 3, sent: 2, failed: 1 },
      errorSummary: "item_failures",
    });
  });
  it("reminders: clean => success", () => {
    expect(summarizeReminders({ processed: 1, sent: 1, failed: 0, errors: [] }).status).toBe("success");
  });
  it("nav: failed => partial, counts only", () => {
    const r = summarizeNavReceipt({ companiesProcessed: 2, submitted: 1, failed: 1, skipped: 0, blocked: 0, results: [{ error: "x" }] });
    expect(r.status).toBe("partial");
    expect(r.counts).toEqual({ companiesProcessed: 2, submitted: 1, failed: 1, skipped: 0, blocked: 0 });
  });
});

describe("withCronRunLog", () => {
  it("records one row and returns the original response untouched", async () => {
    const res = Response.json({ processed: 1, sent: 1, failed: 0, errors: [] });
    const out = await withCronRunLog("reminders", async () => res, summarizeReminders);
    expect(out).toBe(res);
    expect(await out.json()).toEqual({ processed: 1, sent: 1, failed: 0, errors: [] });
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({ job: "reminders", status: "success" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("records failure for 5xx and keeps status", async () => {
    const out = await withCronRunLog("reminders", async () => Response.json({ error: "a@b.hu" }, { status: 500 }), summarizeReminders);
    expect(out.status).toBe(500);
    expect(mockInsertValues.mock.calls[0][0]).toMatchObject({ status: "failure", errorSummary: "http_500" });
  });

  it("records failure and rethrows when the handler throws", async () => {
    const boom = Object.assign(new Error("pw=secret"), { code: "08006" });
    await expect(withCronRunLog("nav-receipt-report", async () => { throw boom; }, summarizeNavReceipt)).rejects.toBe(boom);
    const row = mockInsertValues.mock.calls[0][0];
    expect(row).toMatchObject({ status: "failure", errorSummary: "Error:08006" });
    expect(JSON.stringify(row)).not.toContain("secret");
  });

  it("a failing log write never breaks the cron response", async () => {
    mockInsertValues.mockRejectedValue(new Error("db down"));
    const res = Response.json({ processed: 0, sent: 0, failed: 0, errors: [] });
    await expect(withCronRunLog("reminders", async () => res, summarizeReminders)).resolves.toBe(res);
  });

  it("alerts the owner on partial when OPS_ALERT_EMAIL is set, no PII in body", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@example.test";
    await withCronRunLog("reminders", async () => Response.json({ processed: 2, sent: 1, failed: 1, errors: ["kovacs@x.hu"] }), summarizeReminders);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.to).toBe("ops@example.test");
    expect(arg.html + arg.subject + (arg.text ?? "")).not.toContain("kovacs");
    expect(arg.subject).toContain("reminders");
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("skips alert silently without OPS_ALERT_EMAIL", async () => {
    await withCronRunLog("reminders", async () => Response.json({ error: "x" }, { status: 500 }), summarizeReminders);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("throttles to one alert per job per day", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@example.test";
    mockSelectLimit.mockResolvedValue([{ id: "earlier" }]);
    await withCronRunLog("reminders", async () => Response.json({ error: "x" }, { status: 500 }), summarizeReminders);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("an e-mail failure never breaks the cron", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@example.test";
    mockSend.mockRejectedValue(new Error("smtp"));
    const res = Response.json({ error: "x" }, { status: 500 });
    await expect(withCronRunLog("reminders", async () => res, summarizeReminders)).resolves.toBe(res);
  });
});

describe("getCronHealth", () => {
  it("derives lastSuccessAt, lastRunAt, lastStatus per job", async () => {
    const t = (s: string) => new Date(s);
    mockSelectLimit.mockResolvedValue([
      { job: "reminders", status: "partial", finishedAt: t("2026-11-08T09:00:05Z") },
      { job: "reminders", status: "success", finishedAt: t("2026-11-07T09:00:05Z") },
    ]);
    const h = await getCronHealth();
    expect(h?.reminders).toEqual({
      lastSuccessAt: "2026-11-07T09:00:05.000Z",
      lastRunAt: "2026-11-08T09:00:05.000Z",
      lastStatus: "partial",
    });
    expect(h?.["nav-receipt-report"]).toEqual({ lastSuccessAt: null, lastRunAt: null, lastStatus: null });
  });
  it("returns null on DB error", async () => {
    mockSelectLimit.mockRejectedValue(new Error("down"));
    expect(await getCronHealth()).toBeNull();
  });
});
