// __tests__/api/admin/user-export.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
jest.mock("@/lib/account/export", () => ({ exportRetainedRecords: jest.fn() }));

import { requireSession } from "@/lib/api/session";
import { exportRetainedRecords } from "@/lib/account/export";
import { GET } from "@/app/api/admin/users/[id]/export+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockExport = exportRetainedRecords as jest.MockedFunction<typeof exportRetainedRecords>;

function call(id: string) {
  return GET(new Request(`http://localhost/api/admin/users/${id}/export`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/admin/users/:id/export", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null);
    expect((await call("u2")).status).toBe(401);
  });

  it("returns 403 for non-admins (a user cannot pull another user's invoices)", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "accountant" } } as never);
    expect((await call("u2")).status).toBe(403);
    expect(mockExport).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown user", async () => {
    mockSession.mockResolvedValue({ user: { id: "a1", role: "admin" } } as never);
    mockExport.mockResolvedValue(null);
    expect((await call("ghost")).status).toBe(404);
  });

  it("returns the retained records as a JSON attachment", async () => {
    mockSession.mockResolvedValue({ user: { id: "a1", role: "admin" } } as never);
    mockExport.mockResolvedValue({
      exportedAt: "2026-09-22T10:00:00.000Z",
      user: { id: "u2", closedAt: "2026-09-22T10:00:00.000Z", retentionUntil: "2034-12-31T23:59:59.999Z" },
      companies: [],
      invoices: [],
      navSubmissions: [],
      receipts: [],
      navReceiptSubmissions: [],
    });
    const response = await call("u2");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="invohub-retained-u2.json"'
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).user.id).toBe("u2");
    expect(mockExport).toHaveBeenCalledWith("u2");
  });
});
