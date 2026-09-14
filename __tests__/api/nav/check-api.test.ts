// __tests__/api/nav/check-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

const mockTokenExchange = jest.fn();
jest.mock("@/lib/nav/client", () => ({
  getNavClient: jest.fn(() => ({ tokenExchange: mockTokenExchange })),
}));

import { requireSession } from "@/lib/api/session";
import { getCompanyByUserId } from "@/lib/companies/service";
import { getNavClient } from "@/lib/nav/client";
import { GET, POST } from "@/app/api/nav/check+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockGetNavClient = getNavClient as jest.MockedFunction<typeof getNavClient>;

const savedCompany = {
  id: "c1",
  userId: "user-1",
  name: "Saved Kft.",
  taxNumber: "12345678-1-23",
  navEnvironment: "test" as const,
  navTechnicalUser: "saved-user",
  navTechnicalPassword: "saved-pass",
  navXmlSignKey: "saved-sign",
  navXmlChangeKey: "saved-change",
  createdAt: "",
  updatedAt: "",
};

function postRequest(body: unknown) {
  return new Request("http://localhost/api/nav/check", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/nav/check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockTokenExchange.mockResolvedValue({ exchangeToken: "abcdef123456" });
  });

  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await POST(postRequest({}));
    expect(response.status).toBe(401);
  });

  it("checks the currently typed (unsaved) credentials, not the persisted ones", async () => {
    mockGetCompany.mockResolvedValue(savedCompany as never);

    const response = await POST(
      postRequest({
        navEnvironment: "test",
        navTechnicalUser: "just-typed-user",
        navTechnicalPassword: "just-typed-pass",
        navXmlSignKey: "just-typed-sign",
        navXmlChangeKey: "just-typed-change",
        taxNumber: "12345678-1-23",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    // The credentials actually exchanged must reflect the form values, not
    // savedCompany's navTechnicalUser/-Password/etc.
    expect(mockTokenExchange).toHaveBeenCalledWith(
      expect.objectContaining({ login: "just-typed-user", password: "just-typed-pass" })
    );
  });

  it("falls back to the saved value for any field left blank in the request", async () => {
    mockGetCompany.mockResolvedValue(savedCompany as never);

    await POST(
      postRequest({
        navEnvironment: "test",
        // Only the password is being edited; everything else is blank
        // (not yet retyped into the masked fields).
        navTechnicalPassword: "new-pass",
      })
    );

    expect(mockTokenExchange).toHaveBeenCalledWith(
      expect.objectContaining({ login: "saved-user", password: "new-pass" })
    );
  });

  it("GET checks the persisted company with no overrides", async () => {
    mockGetCompany.mockResolvedValue(savedCompany as never);

    const response = await GET(new Request("http://localhost/api/nav/check"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockTokenExchange).toHaveBeenCalledWith(
      expect.objectContaining({ login: "saved-user", password: "saved-pass" })
    );
  });

  it("demo mode pings the simulator without needing any credentials", async () => {
    mockGetCompany.mockResolvedValue({ ...savedCompany, navEnvironment: "demo" } as never);

    const response = await POST(postRequest({ navEnvironment: "demo" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockTokenExchange).toHaveBeenCalledWith(null);
  });
});
