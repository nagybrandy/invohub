// __tests__/api/v1/client-id.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/clients/service", () => ({
  getClientById: jest.fn(),
  updateClient: jest.fn(),
  deleteClientById: jest.fn(),
}));

import { DELETE, GET, PATCH } from "@/app/api/v1/clients/[id]+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { deleteClientById, getClientById, updateClient } from "@/lib/clients/service";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockGet = getClientById as jest.MockedFunction<typeof getClientById>;
const mockUpdate = updateClient as jest.MockedFunction<typeof updateClient>;
const mockDelete = deleteClientById as jest.MockedFunction<typeof deleteClientById>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function authFail() {
  mockAuth.mockResolvedValue({
    ok: false,
    response: Response.json({ error: "Invalid API key." }, { status: 401 }),
  } as never);
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/clients/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await GET(new Request("http://localhost/api/v1/clients/c1"), params("c1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign client", async () => {
    authOk();
    mockGet.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/clients/missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns the client scoped to the key's userId", async () => {
    authOk("user-1");
    mockGet.mockResolvedValue({ id: "c1", userId: "user-1", name: "Acme" } as never);
    const response = await GET(new Request("http://localhost/api/v1/clients/c1"), params("c1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.client.name).toBe("Acme");
    expect(mockGet).toHaveBeenCalledWith("user-1", "c1");
  });
});

describe("PATCH /api/v1/clients/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for a missing/foreign client", async () => {
    authOk();
    mockUpdate.mockResolvedValue(null);
    const response = await PATCH(
      new Request("http://localhost/api/v1/clients/missing", { method: "PATCH", body: JSON.stringify({ name: "X" }) }),
      params("missing")
    );
    expect(response.status).toBe(404);
  });

  it("updates the client", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({ id: "c1", userId: "user-1", name: "Updated" } as never);
    const response = await PATCH(
      new Request("http://localhost/api/v1/clients/c1", { method: "PATCH", body: JSON.stringify({ name: "Updated" }) }),
      params("c1")
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.client.name).toBe("Updated");
  });
});

describe("DELETE /api/v1/clients/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for a missing/foreign client", async () => {
    authOk();
    mockDelete.mockResolvedValue(false);
    const response = await DELETE(new Request("http://localhost/api/v1/clients/missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("deletes the client", async () => {
    authOk();
    mockDelete.mockResolvedValue(true);
    const response = await DELETE(new Request("http://localhost/api/v1/clients/c1"), params("c1"));
    expect(response.status).toBe(204);
  });
});
