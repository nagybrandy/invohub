// __tests__/api/v1/invoice-convert.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/convert-handler", () => ({
  performConvert: jest.fn(),
}));

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

import { POST } from "@/app/api/v1/invoices/[id]/convert+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { performConvert } from "@/lib/invoices/convert-handler";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockPerform = performConvert as jest.MockedFunction<typeof performConvert>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(id: string) {
  return new Request(`http://localhost/api/v1/invoices/${id}/convert`, { method: "POST" });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/invoices/[id]/convert", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await POST(req("proforma-1"), params("proforma-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk();
    mockPerform.mockResolvedValue({ ok: false, reason: "not_found" });
    const response = await POST(req("missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns 400 notProforma for a non-proforma document", async () => {
    authOk();
    mockPerform.mockResolvedValue({ ok: false, reason: "notProforma" });
    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("notProforma");
  });

  it("returns 409 alreadyConverted carrying the existing invoice — the required backward-compat behaviour", async () => {
    authOk();
    const existing = makeInvoice({ id: "existing-inv", status: "draft" });
    mockPerform.mockResolvedValue({ ok: false, reason: "already_converted", invoice: existing });

    const response = await POST(req("proforma-1"), params("proforma-1"));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("alreadyConverted");
    expect(body.invoice.id).toBe("existing-inv");
  });

  it("returns 201 with the new draft invoice for a valid díjbekérő", async () => {
    authOk("user-1");
    const draft = makeInvoice({ id: "new-inv-1", documentType: "invoice", status: "draft" });
    mockPerform.mockResolvedValue({ ok: true, invoice: draft });

    const response = await POST(req("proforma-1"), params("proforma-1"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.invoice.documentType).toBe("invoice");
    expect(mockPerform).toHaveBeenCalledWith("user-1", "proforma-1");
  });
});
