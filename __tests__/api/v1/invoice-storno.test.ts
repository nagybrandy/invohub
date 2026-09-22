// __tests__/api/v1/invoice-storno.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/storno-handler", () => ({
  performStorno: jest.fn(),
}));

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

import { POST } from "@/app/api/v1/invoices/[id]/storno+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { performStorno } from "@/lib/invoices/storno-handler";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockPerform = performStorno as jest.MockedFunction<typeof performStorno>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(id: string) {
  return new Request(`http://localhost/api/v1/invoices/${id}/storno`, { method: "POST" });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/invoices/[id]/storno", () => {
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

  it("returns 400 for an already-cancelled invoice", async () => {
    authOk();
    mockPerform.mockResolvedValue({ ok: false, reason: "already_cancelled" });
    const response = await POST(req("inv-1"), params("inv-1"));
    expect(response.status).toBe(400);
  });

  it("creates the storno document", async () => {
    authOk("user-1");
    const storno = makeInvoice({ id: "storno-1", documentType: "storno" });
    mockPerform.mockResolvedValue({ ok: true, invoice: storno });

    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.invoice.documentType).toBe("storno");
    expect(mockPerform).toHaveBeenCalledWith("user-1", "inv-1");
  });
});
