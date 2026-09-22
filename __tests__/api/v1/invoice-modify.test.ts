// __tests__/api/v1/invoice-modify.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/modify-handler", () => ({
  performModify: jest.fn(),
}));

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

import { POST } from "@/app/api/v1/invoices/[id]/modify+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { performModify } from "@/lib/invoices/modify-handler";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockPerform = performModify as jest.MockedFunction<typeof performModify>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(id: string) {
  return new Request(`http://localhost/api/v1/invoices/${id}/modify`, { method: "POST" });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/invoices/[id]/modify", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await POST(req("inv-1"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk();
    mockPerform.mockResolvedValue({ ok: false, reason: "not_found" });
    const response = await POST(req("missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns 400 with code proformaNotStornoable for a proforma", async () => {
    authOk();
    mockPerform.mockResolvedValue({ ok: false, reason: "proforma" });
    const response = await POST(req("proforma-1"), params("proforma-1"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("proformaNotStornoable");
  });

  it("creates a correction draft", async () => {
    authOk("user-1");
    const draft = makeInvoice({ id: "modify-1", documentType: "modify", status: "draft", invoiceNumber: "" });
    mockPerform.mockResolvedValue({ ok: true, invoice: draft });

    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.invoice.documentType).toBe("modify");
    expect(mockPerform).toHaveBeenCalledWith("user-1", "inv-1");
  });
});
