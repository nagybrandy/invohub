// lib/api/session.test.ts
/** @jest-environment node */
const mockGetSession = jest.fn();
const mockGetAccountRole = jest.fn();

jest.mock("@/lib/auth", () => ({ auth: { api: { getSession: (...a: unknown[]) => mockGetSession(...a) } } }));
jest.mock("@/lib/workspaces/service", () => ({ getAccountRole: (...a: unknown[]) => mockGetAccountRole(...a) }));

import { jsonResponse, requireActor, requireSession, unauthorizedResponse } from "@/lib/api/session";

const PERSON = { user: { id: "person-1", name: "Kovács Anna", email: "anna@x.hu", role: "entrepreneur" }, session: { id: "s" } };
const req = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new Request(`https://app.invohub.hu${path}`, { method: init.method ?? "GET", headers: init.headers });

describe("api session helpers", () => {
  it("unauthorizedResponse returns 401 JSON", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("jsonResponse serializes data", async () => {
    const res = jsonResponse({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("requireSession — billing account scoping", () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue(PERSON);
    mockGetAccountRole.mockReset();
  });

  it("returns null when nobody is signed in, whatever account is requested", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await requireSession(req("/api/invoices", { headers: { "x-invohub-account": "workspace-123" } }))).toBeNull();
    expect(mockGetAccountRole).not.toHaveBeenCalled();
  });

  it("is the person's own session when no account is selected, or their own is selected", async () => {
    expect(await requireSession(req("/api/invoices"))).toBe(PERSON);
    expect(await requireSession(req("/api/invoices", { headers: { "x-invohub-account": "person-1" } }))).toBe(PERSON);
    expect(mockGetAccountRole).not.toHaveBeenCalled();
  });

  it("points user.id at the selected account when the person has access, keeping who is really signed in", async () => {
    mockGetAccountRole.mockResolvedValue({ role: "accountant", name: "Ügyfél Kft.", kind: "workspace" });
    const s = await requireSession(req("/api/invoices", { headers: { "x-invohub-account": "workspace-123" } }));
    expect(mockGetAccountRole).toHaveBeenCalledWith("person-1", "workspace-123");
    expect(s?.user).toMatchObject({ id: "workspace-123", name: "Ügyfél Kft.", role: "entrepreneur" });
    expect(s?.scope).toEqual({ accountId: "workspace-123", role: "accountant", actorId: "person-1" });
  });

  it("reads the selection from the cookie too (iframes and downloads cannot send headers)", async () => {
    mockGetAccountRole.mockResolvedValue({ role: "viewer", name: "X", kind: "workspace" });
    const s = await requireSession(req("/api/invoices/abc/pdf", { headers: { cookie: "a=1; invohub_account=workspace-123; b=2" } }));
    expect(s?.user.id).toBe("workspace-123");
  });

  it("refuses an account the person has no access to — never falls back to their own data", async () => {
    mockGetAccountRole.mockResolvedValue(null);
    expect(await requireSession(req("/api/invoices", { headers: { "x-invohub-account": "somebody-elses" } }))).toBeNull();
  });

  it("ignores a malformed selection instead of querying with it", async () => {
    for (const bad of ["../etc", "a b", "x".repeat(200), "'; drop table user;--"]) {
      expect(await requireSession(req("/api/invoices", { headers: { "x-invohub-account": bad } }))).toBe(PERSON);
    }
    expect(mockGetAccountRole).not.toHaveBeenCalled();
  });

  it("enforces the role: a viewer cannot write, an accountant cannot touch credentials", async () => {
    mockGetAccountRole.mockResolvedValue({ role: "viewer", name: "X", kind: "workspace" });
    expect(await requireSession(req("/api/invoices", { method: "POST", headers: { "x-invohub-account": "workspace-123" } }))).toBeNull();
    expect((await requireSession(req("/api/invoices", { headers: { "x-invohub-account": "workspace-123" } })))?.user.id).toBe("workspace-123");

    mockGetAccountRole.mockResolvedValue({ role: "accountant", name: "X", kind: "workspace" });
    expect(await requireSession(req("/api/companies", { method: "POST", headers: { "x-invohub-account": "workspace-123" } }))).toBeNull();
    expect(await requireSession(req("/api/api-keys", { headers: { "x-invohub-account": "workspace-123" } }))).toBeNull();
    expect((await requireSession(req("/api/invoices", { method: "POST", headers: { "x-invohub-account": "workspace-123" } })))?.user.id).toBe("workspace-123");
  });

  it("platform admin routes ignore the selection and act as the person", async () => {
    expect(await requireSession(req("/api/admin/users", { headers: { "x-invohub-account": "workspace-123" } }))).toBe(PERSON);
    expect(mockGetAccountRole).not.toHaveBeenCalled();
  });
});

describe("requireActor", () => {
  it("is always the person, whatever account is selected", async () => {
    mockGetSession.mockResolvedValue(PERSON);
    expect(await requireActor(req("/api/workspaces", { headers: { "x-invohub-account": "workspace-123" } }))).toBe(PERSON);
    mockGetSession.mockResolvedValue(null);
    expect(await requireActor(req("/api/workspaces"))).toBeNull();
  });
});
