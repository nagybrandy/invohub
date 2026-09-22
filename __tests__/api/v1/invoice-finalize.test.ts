// __tests__/api/v1/invoice-finalize.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/service", () => ({
  finalizeInvoice: jest.fn(),
}));

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

import { POST } from "@/app/api/v1/invoices/[id]/finalize+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { finalizeInvoice } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockFinalize = finalizeInvoice as jest.MockedFunction<typeof finalizeInvoice>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(id: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/api/v1/invoices/${id}/finalize`, {
    method: "POST",
    headers,
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/invoices/[id]/finalize", () => {
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
    mockFinalize.mockResolvedValue({ ok: false, reason: "not_found" });
    const response = await POST(req("missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns 409 with code notDraft for an already-finalized invoice, allocating nothing", async () => {
    authOk();
    mockFinalize.mockResolvedValue({ ok: false, reason: "not_draft" });
    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe("notDraft");
  });

  it("returns 422 with code buyerAddressMissing without allocating a number", async () => {
    authOk();
    mockFinalize.mockResolvedValue({ ok: false, reason: "buyer_address_missing" });
    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("buyerAddressMissing");
  });

  it("returns 200 with the finalized (numbered) invoice", async () => {
    authOk("user-1");
    const finalized = makeInvoice({ id: "inv-1", status: "unpaid", invoiceNumber: "INV-2026-00007" });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });

    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.invoiceNumber).toBe("INV-2026-00007");
    expect(mockFinalize).toHaveBeenCalledWith("user-1", "inv-1");
  });
});
