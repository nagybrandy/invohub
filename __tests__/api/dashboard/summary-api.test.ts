// __tests__/api/dashboard/summary-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/dashboard/summary", () => ({
  getDashboardSummaryFromDb: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { GET } from "@/app/api/dashboard/summary+api";
import { getDashboardSummaryFromDb } from "@/lib/dashboard/summary";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetSummary = getDashboardSummaryFromDb as jest.MockedFunction<
  typeof getDashboardSummaryFromDb
>;

describe("GET /api/dashboard/summary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/dashboard/summary"));
    expect(response.status).toBe(401);
  });

  it("returns the SQL-aggregated summary", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetSummary.mockResolvedValue({
      revenue: 100,
      outstanding: 50,
      overdueTotal: 10,
      issuedTotal: 5,
      estimatedVat: 20,
      overdueCount: 1,
      oldestOverdueDays: 3,
      recentInvoices: [],
    });

    const response = await GET(new Request("http://localhost/api/dashboard/summary"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.revenue).toBe(100);
    expect(mockGetSummary).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 on failure", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetSummary.mockRejectedValue(new Error("db down"));

    const response = await GET(new Request("http://localhost/api/dashboard/summary"));
    expect(response.status).toBe(500);
  });
});
