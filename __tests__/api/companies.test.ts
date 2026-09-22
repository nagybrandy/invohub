// __tests__/api/companies.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
  upsertCompany: jest.fn(),
}));

// toPublicCompany is a pure redaction helper with no DB import — use the
// real implementation (not mocked) so these tests exercise the actual
// response shape.

import { GET, POST } from "@/app/api/companies+api";
import { getCompanyByUserId, upsertCompany } from "@/lib/companies/service";
import { requireSession } from "@/lib/api/session";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockUpsert = upsertCompany as jest.MockedFunction<typeof upsertCompany>;

describe("companies API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/companies"));
    expect(response.status).toBe(401);
  });

  it("GET returns company profile", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetCompany.mockResolvedValue({
      id: "c1",
      userId: "user-1",
      name: "Demo Kft.",
      navEnvironment: "test",
      createdAt: "",
      updatedAt: "",
    });

    const response = await GET(new Request("http://localhost/api/companies"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.company.name).toBe("Demo Kft.");
    expect(body.company.navEnvironment).toBe("test");
  });

  it("GET never returns decrypted NAV secrets, only whether one is set", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetCompany.mockResolvedValue({
      id: "c1",
      userId: "user-1",
      name: "Demo Kft.",
      navEnvironment: "test",
      navTechnicalUser: "nav-user",
      navTechnicalPassword: "super-secret-password",
      navXmlSignKey: "super-secret-sign-key",
      navXmlChangeKey: "super-secret-change-key",
      createdAt: "",
      updatedAt: "",
    });

    const response = await GET(new Request("http://localhost/api/companies"));
    const body = await response.json();
    const raw = JSON.stringify(body);

    expect(raw).not.toContain("super-secret-password");
    expect(raw).not.toContain("super-secret-sign-key");
    expect(raw).not.toContain("super-secret-change-key");
    expect(body.company.navTechnicalUser).toBe("nav-user");
    expect(body.company.navTechnicalPasswordSet).toBe(true);
    expect(body.company.navXmlSignKeySet).toBe(true);
    expect(body.company.navXmlChangeKeySet).toBe(true);
  });

  it("POST rejects invalid navEnvironment", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST(
      new Request("http://localhost/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Demo Kft.", navEnvironment: "staging" }),
      })
    );

    expect(response.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("POST upserts company with navEnvironment", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockResolvedValue({
      id: "c1",
      userId: "user-1",
      name: "Demo Kft.",
      navEnvironment: "production",
      createdAt: "",
      updatedAt: "",
    });

    const response = await POST(
      new Request("http://localhost/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Demo Kft.",
          navEnvironment: "production",
          navTechnicalUser: "nav-user",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith("user-1", {
      name: "Demo Kft.",
      navEnvironment: "production",
      navTechnicalUser: "nav-user",
    });
    expect(body.company.navEnvironment).toBe("production");
  });

  describe("credential exposure & access control", () => {
    const stored = {
      id: "c1",
      userId: "user-1",
      name: "Demo Kft.",
      taxNumber: "12345678-1-23",
      navEnvironment: "test" as const,
      navTechnicalUser: "nav-user",
      navTechnicalPassword: "gcm2:k1:SEALEDPW:tag:ct",
      navXmlSignKey: "gcm2:k1:SEALEDSIGN:tag:ct",
      navXmlChangeKey: "gcm2:k1:SEALEDCHANGE:tag:ct",
      createdAt: "",
      updatedAt: "",
    };

    it("GET returns masked secrets + configured flag, never the stored (sealed) value", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockGetCompany.mockResolvedValue(stored);

      const response = await GET(new Request("http://localhost/api/companies"));
      const body = await response.json();
      const raw = JSON.stringify(body);

      expect(raw).not.toContain("SEALED");
      expect(raw).not.toContain("gcm2:");
      expect(body.company.navCredentialsConfigured).toBe(true);
      expect(body.company.navTechnicalPasswordMasked).toBe("••••••••");
      expect(body.company.navXmlSignKeyMasked).toBe("••••••••");
      expect(body.company.navXmlChangeKeyMasked).toBe("••••••••");
    });

    it("GET reports configured:false and null masks when nothing is stored", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockGetCompany.mockResolvedValue({ id: "c1", userId: "user-1", name: "X", createdAt: "", updatedAt: "" });

      const body = await (await GET(new Request("http://localhost/api/companies"))).json();
      expect(body.company.navCredentialsConfigured).toBe(false);
      expect(body.company.navTechnicalPasswordMasked).toBeNull();
    });

    it("GET only ever loads the session user's own company (no id/userId from the request is honoured)", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-2" } } as never);
      mockGetCompany.mockResolvedValue(null);

      const response = await GET(new Request("http://localhost/api/companies?userId=user-1&id=c1"));
      const body = await response.json();

      expect(mockGetCompany).toHaveBeenCalledTimes(1);
      expect(mockGetCompany).toHaveBeenCalledWith("user-2");
      expect(body.company).toBeNull();
    });

    it("POST writes to the session user's company even if the body names another user", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-2" } } as never);
      mockUpsert.mockResolvedValue({ ...stored, userId: "user-2" });

      const response = await POST(
        new Request("http://localhost/api/companies", {
          method: "POST",
          body: JSON.stringify({ name: "Evil", userId: "user-1", id: "c1", navTechnicalPassword: "x" }),
        })
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith("user-2", expect.anything());
      expect(mockUpsert.mock.calls[0][0]).toBe("user-2");
      expect(JSON.stringify(body)).not.toContain("SEALED");
    });

    it("POST 401s without a session and never touches storage", async () => {
      mockSession.mockResolvedValue(null);
      const response = await POST(
        new Request("http://localhost/api/companies", {
          method: "POST",
          body: JSON.stringify({ name: "X", navTechnicalPassword: "pw" }),
        })
      );
      expect(response.status).toBe(401);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("POST never echoes DB errors (which carry bound params) to the client or the log", async () => {
      mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockUpsert.mockRejectedValue(
        Object.assign(
          new Error('Failed query: update "company" set "nav_technical_password" = $1\nparams: gcm2:k1:SEALEDPW:tag:ct,plain-typed-pw'),
          { cause: { params: ["plain-typed-pw"] } }
        )
      );

      const response = await POST(
        new Request("http://localhost/api/companies", {
          method: "POST",
          body: JSON.stringify({ name: "X", navTechnicalPassword: "plain-typed-pw" }),
        })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(JSON.stringify(body)).not.toContain("plain-typed-pw");
      expect(JSON.stringify(body)).not.toContain("SEALED");
      expect(JSON.stringify(spy.mock.calls)).not.toContain("plain-typed-pw");
      spy.mockRestore();
    });
  });
});
