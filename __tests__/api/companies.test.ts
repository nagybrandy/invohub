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
