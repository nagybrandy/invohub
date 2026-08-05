// __tests__/api/m2m-demo.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/m2m/credentials", () => ({
  isM2mConfigured: jest.fn(),
  M2mConfigError: class M2mConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "M2mConfigError";
    }
  },
}));

jest.mock("@/lib/m2m/demo-user", () => ({
  fetchM2mDemoSnapshot: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { isM2mConfigured, M2mConfigError } from "@/lib/m2m/credentials";
import { fetchM2mDemoSnapshot } from "@/lib/m2m/demo-user";
import { GET } from "@/app/api/m2m/demo+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockIsConfigured = isM2mConfigured as jest.MockedFunction<typeof isM2mConfigured>;
const mockFetchSnapshot = fetchM2mDemoSnapshot as jest.MockedFunction<typeof fetchM2mDemoSnapshot>;

describe("GET /api/m2m/demo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    expect(response.status).toBe(401);
  });

  it("returns 503 when M2M is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("M2M not configured.");
    expect(body.hint).toContain("M2M_*");
  });

  it("returns snapshot when configured", async () => {
    mockIsConfigured.mockReturnValue(true);
    const snapshot = { taxpayer: { name: "Test" }, checks: [] };
    mockFetchSnapshot.mockResolvedValue(snapshot as never);

    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshot).toEqual(snapshot);
    expect(body.configured).toBe(true);
  });

  it("passes taxpayerId and seed query params", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockFetchSnapshot.mockResolvedValue({ taxpayer: {} } as never);

    await GET(new Request("http://localhost/api/m2m/demo?taxpayerId=12345&seed=42"));

    expect(mockFetchSnapshot).toHaveBeenCalledWith({
      taxpayerId: "12345",
      seed: 42,
    });
  });

  it("returns 503 on M2mConfigError", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockFetchSnapshot.mockRejectedValue(new M2mConfigError("Missing key"));

    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Missing key");
  });

  it("returns 502 on generic error", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockFetchSnapshot.mockRejectedValue(new Error("API timeout"));

    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("API timeout");
  });

  it("handles non-finite seed gracefully", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockFetchSnapshot.mockResolvedValue({ taxpayer: {} } as never);

    await GET(new Request("http://localhost/api/m2m/demo?seed=notanumber"));

    expect(mockFetchSnapshot).toHaveBeenCalledWith({
      taxpayerId: undefined,
      seed: undefined,
    });
  });
});
