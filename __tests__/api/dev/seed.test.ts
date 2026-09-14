// __tests__/api/dev/seed.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/dev/seed-guard", () => ({
  isDevSeedAllowed: jest.fn(),
}));

jest.mock("@/lib/seed/demo-data", () => ({
  seedDemoData: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { isDevSeedAllowed } from "@/lib/dev/seed-guard";
import { seedDemoData } from "@/lib/seed/demo-data";
import { POST } from "@/app/api/dev/seed+api";

const mockAllowed = isDevSeedAllowed as jest.MockedFunction<typeof isDevSeedAllowed>;
const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockSeed = seedDemoData as jest.MockedFunction<typeof seedDemoData>;

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/dev/seed", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/dev/seed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllowed.mockReturnValue(true);
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSeed.mockResolvedValue({
      clients: 1,
      products: 1,
      invoices: 1,
      receipts: 1,
      incoming: 0,
      receiptLineItems: 0,
      navReceiptSubmissions: 0,
    } as never);
  });

  it("returns 404 when dev seed is not allowed (e.g. production)", async () => {
    mockAllowed.mockReturnValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    expect(mockSession).not.toHaveBeenCalled();
    expect(mockSeed).not.toHaveBeenCalled();
  });

  it("returns 401 without a session even when seeding is allowed", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockSeed).not.toHaveBeenCalled();
  });

  it("seeds demo data for the authenticated user", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSeed).toHaveBeenCalledWith("user-1");
  });

  it("never promotes a role — the promoteAdmin escape hatch is gone", async () => {
    const res = await POST(makeRequest({ promoteAdmin: true }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.promoted).toBeUndefined();
    expect(mockSeed).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 on unexpected exception", async () => {
    mockSeed.mockRejectedValue(new Error("DB unavailable"));
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("DB unavailable");
  });
});
