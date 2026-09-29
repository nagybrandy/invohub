// __tests__/api/m2m-check.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/m2m/auth", () => ({
  createM2mSession: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { createM2mSession } from "@/lib/m2m/auth";
import { GET } from "@/app/api/m2m/check+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockCreateSession = createM2mSession as jest.MockedFunction<typeof createM2mSession>;

const M2M_ENV_KEYS = [
  "M2M_ENV",
  "M2M_CLIENT_ID",
  "M2M_CLIENT_SECRET",
  "M2M_USERNAME",
  "M2M_PASSWORD",
  "M2M_SIGNATURE_KEY_FIRST",
  "M2M_NONCE",
] as const;

describe("GET /api/m2m/check", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of M2M_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  afterEach(() => {
    for (const k of M2M_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  function configure(env: "test" | "production") {
    process.env.M2M_ENV = env;
    process.env.M2M_CLIENT_ID = "client-id";
    process.env.M2M_CLIENT_SECRET = "client-secret-value";
    process.env.M2M_USERNAME = "m2m-user";
    process.env.M2M_PASSWORD = "m2m-password-value";
    process.env.M2M_SIGNATURE_KEY_FIRST = "sigfirst-value";
    process.env.M2M_NONCE = "nonce-value";
  }

  it("401s without a session", async () => {
    mockSession.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/m2m/check"))).status).toBe(401);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("refuses the production M2M environment", async () => {
    configure("production");
    const response = await GET(new Request("http://localhost/api/m2m/check"));
    expect(response.status).toBe(403);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("never returns M2M secrets, even in an error", async () => {
    configure("test");
    mockCreateSession.mockRejectedValue(new Error("M2M request failed (401): bad credentials"));

    const response = await GET(new Request("http://localhost/api/m2m/check"));
    const raw = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    for (const secret of ["client-secret-value", "m2m-password-value", "sigfirst-value", "nonce-value"]) {
      expect(raw).not.toContain(secret);
    }
  });
});
