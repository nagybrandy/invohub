// __tests__/api/v1/clients.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/clients/service", () => ({
  listClients: jest.fn(),
  createClient: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/clients+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { createClient, listClients } from "@/lib/clients/service";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockList = listClients as jest.MockedFunction<typeof listClients>;
const mockCreate = createClient as jest.MockedFunction<typeof createClient>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function authFail() {
  mockAuth.mockResolvedValue({
    ok: false,
    response: Response.json({ error: "Invalid API key." }, { status: 401 }),
  } as never);
}

describe("GET /api/v1/clients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await GET(new Request("http://localhost/api/v1/clients"));
    expect(response.status).toBe(401);
  });

  it("lists clients scoped to the key's userId", async () => {
    authOk("user-1");
    mockList.mockResolvedValue([{ id: "c1", userId: "user-1", name: "Acme" } as never]);
    const response = await GET(new Request("http://localhost/api/v1/clients"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.clients).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/v1/clients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await POST(
      new Request("http://localhost/api/v1/clients", { method: "POST", body: JSON.stringify({ name: "Acme" }) })
    );
    expect(response.status).toBe(401);
  });

  it("requires a name", async () => {
    authOk();
    const response = await POST(
      new Request("http://localhost/api/v1/clients", { method: "POST", body: JSON.stringify({}) })
    );
    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a client", async () => {
    authOk("user-1");
    mockCreate.mockResolvedValue({ id: "c1", userId: "user-1", name: "Acme" } as never);
    const response = await POST(
      new Request("http://localhost/api/v1/clients", { method: "POST", body: JSON.stringify({ name: "Acme" }) })
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.client.name).toBe("Acme");
    expect(mockCreate).toHaveBeenCalledWith("user-1", { name: "Acme" });
  });
});
