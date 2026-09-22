// __tests__/api/v1/products.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/products/service", () => ({
  listProducts: jest.fn(),
  createProduct: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/products+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { createProduct, listProducts } from "@/lib/products/service";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockList = listProducts as jest.MockedFunction<typeof listProducts>;
const mockCreate = createProduct as jest.MockedFunction<typeof createProduct>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function authFail() {
  mockAuth.mockResolvedValue({
    ok: false,
    response: Response.json({ error: "Invalid API key." }, { status: 401 }),
  } as never);
}

describe("GET /api/v1/products", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await GET(new Request("http://localhost/api/v1/products"));
    expect(response.status).toBe(401);
  });

  it("lists products scoped to the key's userId", async () => {
    authOk("user-1");
    mockList.mockResolvedValue([{ id: "p1", userId: "user-1", name: "Widget" } as never]);
    const response = await GET(new Request("http://localhost/api/v1/products"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.products).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/v1/products", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires a name", async () => {
    authOk();
    const response = await POST(
      new Request("http://localhost/api/v1/products", { method: "POST", body: JSON.stringify({}) })
    );
    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a product", async () => {
    authOk("user-1");
    mockCreate.mockResolvedValue({ id: "p1", userId: "user-1", name: "Widget", unitPrice: 100 } as never);
    const response = await POST(
      new Request("http://localhost/api/v1/products", {
        method: "POST",
        body: JSON.stringify({ name: "Widget", unitPrice: 100 }),
      })
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.product.name).toBe("Widget");
    expect(mockCreate).toHaveBeenCalledWith("user-1", { name: "Widget", unitPrice: 100 });
  });
});
