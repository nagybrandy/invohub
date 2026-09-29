// __tests__/api/admin/user-close.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
jest.mock("@/lib/account/closure", () => ({ closeAccount: jest.fn() }));

import { requireSession } from "@/lib/api/session";
import { closeAccount } from "@/lib/account/closure";
import { POST } from "@/app/api/admin/users/[id]/close+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockClose = closeAccount as jest.MockedFunction<typeof closeAccount>;

function call(id: string, body?: unknown) {
  const request = new Request(`http://localhost/api/admin/users/${id}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/users/:id/close", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null);
    expect((await call("u2", { confirm: true })).status).toBe(401);
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admins", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "entrepreneur" } } as never);
    expect((await call("u2", { confirm: true })).status).toBe(403);
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("refuses to let an admin close their own account", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    expect((await call("admin1", { confirm: true })).status).toBe(403);
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("requires explicit confirm: true", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    expect((await call("u2")).status).toBe(400);
    expect((await call("u2", { confirm: "yes" })).status).toBe(400);
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown user", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    mockClose.mockResolvedValue({ status: "not_found" });
    expect((await call("ghost", { confirm: true })).status).toBe(404);
  });

  it("closes (never hard-deletes) the account and returns the retention window", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    mockClose.mockResolvedValue({
      status: "closed",
      closedAt: new Date("2026-09-22T10:00:00Z"),
      retentionUntil: new Date("2034-12-31T23:59:59.999Z"),
    });
    const response = await call("u2", { confirm: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "closed",
      closedAt: "2026-09-22T10:00:00.000Z",
      retentionUntil: "2034-12-31T23:59:59.999Z",
    });
    expect(mockClose).toHaveBeenCalledWith("u2");
  });

  it("reports already_closed idempotently", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    mockClose.mockResolvedValue({
      status: "already_closed",
      closedAt: new Date("2026-01-01T00:00:00Z"),
      retentionUntil: null,
    });
    const response = await call("u2", { confirm: true });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("already_closed");
  });

  it("returns 500 without leaking internals when closure fails", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin1", role: "admin" } } as never);
    mockClose.mockRejectedValue(new Error("db exploded: secret detail"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const response = await call("u2", { confirm: true });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret detail");
  });
});
