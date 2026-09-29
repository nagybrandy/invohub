// __tests__/api/v1/product-id.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/products/service", () => ({
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
  deleteProductById: jest.fn(),
}));

import { DELETE, GET, PATCH } from "@/app/api/v1/products/[id]+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { deleteProductById, getProductById, updateProduct } from "@/lib/products/service";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockGet = getProductById as jest.MockedFunction<typeof getProductById>;
const mockUpdate = updateProduct as jest.MockedFunction<typeof updateProduct>;
const mockDelete = deleteProductById as jest.MockedFunction<typeof deleteProductById>;

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

describe("GET /api/v1/products/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await GET(new Request("http://localhost/api/v1/products/p1"), params("p1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign product", async () => {
    authOk();
    mockGet.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/products/missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns the product scoped to the key's userId", async () => {
    authOk("user-1");
    mockGet.mockResolvedValue({ id: "p1", userId: "user-1", name: "Widget" } as never);
    const response = await GET(new Request("http://localhost/api/v1/products/p1"), params("p1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.product.name).toBe("Widget");
    expect(mockGet).toHaveBeenCalledWith("user-1", "p1");
  });
});

describe("PATCH /api/v1/products/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for a missing/foreign product", async () => {
    authOk();
    mockUpdate.mockResolvedValue(null);
    const response = await PATCH(
      new Request("http://localhost/api/v1/products/missing", { method: "PATCH", body: JSON.stringify({ name: "X" }) }),
      params("missing")
    );
    expect(response.status).toBe(404);
  });

  it("updates the product", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({ id: "p1", userId: "user-1", name: "Updated" } as never);
    const response = await PATCH(
      new Request("http://localhost/api/v1/products/p1", { method: "PATCH", body: JSON.stringify({ name: "Updated" }) }),
      params("p1")
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.product.name).toBe("Updated");
  });
});

describe("DELETE /api/v1/products/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for a missing/foreign product", async () => {
    authOk();
    mockDelete.mockResolvedValue(false);
    const response = await DELETE(new Request("http://localhost/api/v1/products/missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("deletes the product", async () => {
    authOk();
    mockDelete.mockResolvedValue(true);
    const response = await DELETE(new Request("http://localhost/api/v1/products/p1"), params("p1"));
    expect(response.status).toBe(204);
  });
});
