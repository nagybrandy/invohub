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
});
