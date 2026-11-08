// __tests__/api/recurring/recurring-invoices-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
jest.mock("@/lib/recurring/service", () => {
  class RecurringTemplateError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    RecurringTemplateError,
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplateFromInvoiceId: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
  };
});

import * as list from "@/app/api/recurring-invoices+api";
import * as one from "@/app/api/recurring-invoices/[id]+api";
import { requireSession } from "@/lib/api/session";
import * as service from "@/lib/recurring/service";
import { canPerform } from "@/lib/workspaces/permissions";

const mockSession = requireSession as jest.Mock;
const svc = service as unknown as Record<string, jest.Mock> & { RecurringTemplateError: new (c: string, m: string) => Error };

const req = (method: string, path = "/api/recurring-invoices", body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: "acct-A" } });
});

describe("auth", () => {
  it.each([
    ["list GET", () => list.GET(req("GET"))],
    ["list POST", () => list.POST(req("POST", "/api/recurring-invoices", {}))],
    ["one GET", () => one.GET(req("GET"), ctx("t1"))],
    ["one PATCH", () => one.PATCH(req("PATCH", "/x", {}), ctx("t1"))],
    ["one DELETE", () => one.DELETE(req("DELETE"), ctx("t1"))],
  ])("%s requires a session", async (_n, call) => {
    mockSession.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    for (const fn of Object.values(svc)) if (jest.isMockFunction(fn)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("billing-account scoping", () => {
  it("always passes the ACTIVE account id (session.user.id) to the service", async () => {
    mockSession.mockResolvedValue({ user: { id: "workspace-W" }, scope: { actorId: "person-P" } });
    svc.listTemplates.mockResolvedValue([]);
    await list.GET(req("GET"));
    expect(svc.listTemplates).toHaveBeenCalledWith("workspace-W");

    svc.getTemplate.mockResolvedValue(null);
    await one.GET(req("GET"), ctx("t1"));
    expect(svc.getTemplate).toHaveBeenCalledWith("workspace-W", "t1");

    svc.updateTemplate.mockResolvedValue(null);
    await one.PATCH(req("PATCH", "/x", { status: "paused" }), ctx("t1"));
    expect(svc.updateTemplate).toHaveBeenCalledWith("workspace-W", "t1", { status: "paused" });

    svc.deleteTemplate.mockResolvedValue(false);
    await one.DELETE(req("DELETE"), ctx("t1"));
    expect(svc.deleteTemplate).toHaveBeenCalledWith("workspace-W", "t1");
  });

  it("answers 404 for another account's template (GET/PATCH/DELETE)", async () => {
    svc.getTemplate.mockResolvedValue(null);
    svc.updateTemplate.mockResolvedValue(null);
    svc.deleteTemplate.mockResolvedValue(false);
    expect((await one.GET(req("GET"), ctx("foreign"))).status).toBe(404);
    expect((await one.PATCH(req("PATCH", "/x", { name: "x" }), ctx("foreign"))).status).toBe(404);
    expect((await one.DELETE(req("DELETE"), ctx("foreign"))).status).toBe(404);
  });

  it("creating from another account's invoice is a 404 (service loads it scoped)", async () => {
    svc.createTemplateFromInvoiceId.mockResolvedValue(null);
    const res = await list.POST(
      req("POST", "/api/recurring-invoices", { sourceInvoiceId: "foreign-inv", frequency: "monthly", startDate: "2027-01-01" })
    );
    expect(res.status).toBe(404);
    expect(svc.createTemplateFromInvoiceId.mock.calls[0][0]).toBe("acct-A");
  });

  it("viewers cannot write, accountants can (workspace permissions)", () => {
    expect(canPerform("viewer", "POST", "/api/recurring-invoices")).toBe(false);
    expect(canPerform("viewer", "DELETE", "/api/recurring-invoices/abc")).toBe(false);
    expect(canPerform("viewer", "GET", "/api/recurring-invoices")).toBe(true);
    expect(canPerform("accountant", "PATCH", "/api/recurring-invoices/abc")).toBe(true);
  });
});

describe("behaviour", () => {
  it("lists templates", async () => {
    svc.listTemplates.mockResolvedValue([{ id: "t1" }]);
    const res = await list.GET(req("GET"));
    expect(await res.json()).toEqual({ templates: [{ id: "t1" }] });
  });

  it("creates with 201", async () => {
    svc.createTemplateFromInvoiceId.mockResolvedValue({ id: "t1" });
    const res = await list.POST(
      req("POST", "/api/recurring-invoices", {
        sourceInvoiceId: "inv-1",
        name: "Retainer",
        frequency: "monthly",
        startDate: "2027-01-31",
        maxOccurrences: 12,
      })
    );
    expect(res.status).toBe(201);
    expect(svc.createTemplateFromInvoiceId).toHaveBeenCalledWith(
      "acct-A",
      "inv-1",
      { frequency: "monthly", startDate: "2027-01-31", endDate: null, maxOccurrences: 12 },
      { name: "Retainer" }
    );
  });

  it("400 on a malformed body, 422 with the service's error code", async () => {
    expect((await list.POST(req("POST", "/api/recurring-invoices", { frequency: "monthly" }))).status).toBe(400);
    svc.createTemplateFromInvoiceId.mockRejectedValue(new svc.RecurringTemplateError("invalidSchedule", "bad"));
    const res = await list.POST(
      req("POST", "/api/recurring-invoices", { sourceInvoiceId: "i", frequency: "weekly", startDate: "2027-01-01" })
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "invalidSchedule" });
  });

  it("PATCH maps schedule + status and rejects unknown status", async () => {
    svc.updateTemplate.mockResolvedValue({ id: "t1" });
    const ok = await one.PATCH(
      req("PATCH", "/x", { status: "active", schedule: { frequency: "yearly", startDate: "2028-02-29" } }),
      ctx("t1")
    );
    expect(ok.status).toBe(200);
    expect(svc.updateTemplate).toHaveBeenCalledWith("acct-A", "t1", {
      status: "active",
      schedule: { frequency: "yearly", startDate: "2028-02-29", endDate: null, maxOccurrences: null },
    });
    expect((await one.PATCH(req("PATCH", "/x", { status: "completed" }), ctx("t1"))).status).toBe(400);
  });

  it("DELETE answers 204", async () => {
    svc.deleteTemplate.mockResolvedValue(true);
    expect((await one.DELETE(req("DELETE"), ctx("t1"))).status).toBe(204);
  });
});
