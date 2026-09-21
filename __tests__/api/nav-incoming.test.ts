// __tests__/api/nav-incoming.test.ts
// GET /api/nav/incoming: the plain list branch is always available, but the
// ?sync=true branch calls a hardcoded demo stub (lib/nav/client.ts's
// fetchIncomingInvoices) that invents supplier invoices — it must be gated
// behind isDevSeedAllowed() the same way app/api/dev/seed+api.ts is, and
// requireSession must run before that guard so an unauthenticated caller
// still gets 401, not 404.
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/dev/seed-guard", () => ({
  isDevSeedAllowed: jest.fn(),
}));

jest.mock("@/lib/nav/incoming-sync", () => ({
  syncIncomingInvoices: jest.fn(),
}));

jest.mock("@/db", () => {
  const rows: unknown[] = [];
  return {
    db: {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue(rows),
        })),
      })),
    },
  };
});

jest.mock("@/db/schema", () => ({
  incomingInvoice: { userId: "incomingInvoice.userId" },
}));

import { requireSession } from "@/lib/api/session";
import { isDevSeedAllowed } from "@/lib/dev/seed-guard";
import { syncIncomingInvoices } from "@/lib/nav/incoming-sync";
import { GET } from "@/app/api/nav/incoming+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockAllowed = isDevSeedAllowed as jest.MockedFunction<typeof isDevSeedAllowed>;
const mockSync = syncIncomingInvoices as jest.MockedFunction<typeof syncIncomingInvoices>;

describe("GET /api/nav/incoming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("AC6: sync=true with a session and isDevSeedAllowed()=false returns 404 and never calls syncIncomingInvoices", async () => {
    mockAllowed.mockReturnValue(false);

    const response = await GET(new Request("http://localhost/api/nav/incoming?sync=true"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Not found." });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("AC7: sync=true with a session and isDevSeedAllowed()=true returns 200 with the sync result", async () => {
    mockAllowed.mockReturnValue(true);
    const synced = 2;
    const invoices = [{ id: "inc-1" }, { id: "inc-2" }];
    mockSync.mockResolvedValue({ synced, invoices } as never);

    const response = await GET(new Request("http://localhost/api/nav/incoming?sync=true"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ synced, invoices });
    expect(mockSync).toHaveBeenCalledWith("user-1");
  });

  it("AC8: no sync param returns 200 with the user's rows regardless of isDevSeedAllowed(), and never syncs", async () => {
    for (const allowed of [true, false]) {
      jest.clearAllMocks();
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockAllowed.mockReturnValue(allowed);

      const response = await GET(new Request("http://localhost/api/nav/incoming"));
      expect(response.status).toBe(200);
      expect(mockSync).not.toHaveBeenCalled();
    }
  });

  it("AC9: sync=true with no session returns 401 regardless of the guard", async () => {
    mockSession.mockResolvedValue(null);
    mockAllowed.mockReturnValue(true);

    const response = await GET(new Request("http://localhost/api/nav/incoming?sync=true"));

    expect(response.status).toBe(401);
    expect(mockSync).not.toHaveBeenCalled();
  });
});
