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

jest.mock("@/lib/m2m/simulator", () => ({
  buildM2mSimulatorSnapshot: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { isM2mConfigured, M2mConfigError } from "@/lib/m2m/credentials";
import { fetchM2mDemoSnapshot } from "@/lib/m2m/demo-user";
import { buildM2mSimulatorSnapshot } from "@/lib/m2m/simulator";
import { GET } from "@/app/api/m2m/demo+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockIsConfigured = isM2mConfigured as jest.MockedFunction<typeof isM2mConfigured>;
const mockFetchSnapshot = fetchM2mDemoSnapshot as jest.MockedFunction<typeof fetchM2mDemoSnapshot>;
const mockBuildSimulatorSnapshot = buildM2mSimulatorSnapshot as jest.MockedFunction<
  typeof buildM2mSimulatorSnapshot
>;

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

  it("falls back to the demo simulator when M2M is not configured (no error)", async () => {
    mockIsConfigured.mockReturnValue(false);
    const simulated = { taxpayer: { id: "1", label: "Demo" }, checks: [] };
    mockBuildSimulatorSnapshot.mockReturnValue(simulated as never);

    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshot).toEqual(simulated);
    expect(body.configured).toBe(false);
    expect(body.mode).toBe("demo");
    expect(mockFetchSnapshot).not.toHaveBeenCalled();
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
    expect(body.mode).toBe("test");
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

  it("falls back to the demo simulator on M2mConfigError (no error surfaced)", async () => {
    mockIsConfigured.mockReturnValue(true);
    mockFetchSnapshot.mockRejectedValue(new M2mConfigError("Missing key"));
    const simulated = { taxpayer: { id: "1", label: "Demo" }, checks: [] };
    mockBuildSimulatorSnapshot.mockReturnValue(simulated as never);

    const response = await GET(new Request("http://localhost/api/m2m/demo"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshot).toEqual(simulated);
    expect(body.configured).toBe(false);
    expect(body.mode).toBe("demo");
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

  describe("production guard", () => {
    const original = process.env.M2M_ENV;
    afterEach(() => {
      if (original === undefined) delete process.env.M2M_ENV;
      else process.env.M2M_ENV = original;
    });

    it("refuses to query NAV M2M production with the shared server credentials (any user could pick any taxpayerId)", async () => {
      process.env.M2M_ENV = "production";
      mockIsConfigured.mockReturnValue(true);

      const response = await GET(new Request("http://localhost/api/m2m/demo?taxpayerId=12345678"));

      expect(response.status).toBe(403);
      expect(mockFetchSnapshot).not.toHaveBeenCalled();
    });
  });
});
