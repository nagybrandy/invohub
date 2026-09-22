// __tests__/api/v1/invoice-id.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  deleteDraftInvoiceById: jest.fn(),
}));

jest.mock("@/lib/invoices/create-from-payload", () => ({
  updateDraftInvoiceFromPayload: jest.fn(),
}));

import { DELETE, GET, PATCH } from "@/app/api/v1/invoices/[id]+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { deleteDraftInvoiceById, getInvoiceById } from "@/lib/invoices/service";
import { updateDraftInvoiceFromPayload } from "@/lib/invoices/create-from-payload";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockDelete = deleteDraftInvoiceById as jest.MockedFunction<typeof deleteDraftInvoiceById>;
const mockUpdate = updateDraftInvoiceFromPayload as jest.MockedFunction<
  typeof updateDraftInvoiceFromPayload
>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({
    ok: true,
    userId,
    apiKey: { id: "key-1", userId } as never,
  } as never);
}

function authFail() {
  mockAuth.mockResolvedValue({
    ok: false,
    response: Response.json({ error: "Invalid API key." }, { status: 401 }),
  } as never);
}

function req(method: string, id: string, body?: unknown) {
  return new Request(`http://localhost/api/v1/invoices/${id}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/invoices/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await GET(req("GET", "inv-1"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for an invoice belonging to another user (scoped lookup)", async () => {
    authOk("user-1");
    mockGet.mockResolvedValue(null);
    const response = await GET(req("GET", "foreign-inv"), params("foreign-inv"));
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/invoices/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await PATCH(req("PATCH", "inv-1", { clientName: "X" }), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({ ok: false, reason: "not_found" });
    const response = await PATCH(req("PATCH", "missing", { clientName: "X" }), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns 409 with code notDraft for a finalized invoice", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({ ok: false, reason: "not_draft" });
    const response = await PATCH(req("PATCH", "inv-1", { clientName: "X" }), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe("notDraft");
    expect(body.error).toEqual(expect.any(String));
  });

  it("returns 422 with code companyProfileIncomplete when finalizing would need an incomplete profile", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({
      ok: false,
      reason: "company_profile_incomplete",
      missingFields: ["taxNumber", "city"],
    });
    const response = await PATCH(
      req("PATCH", "inv-1", { clientName: "X", status: "sent" }),
      params("inv-1")
    );
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("companyProfileIncomplete");
    expect(body.missingFields).toEqual(["taxNumber", "city"]);
  });

  it("returns 400 with the validation message on invalid input", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({ ok: false, reason: "validation", message: "clientName is required." });
    const response = await PATCH(req("PATCH", "inv-1", { clientName: "" }), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe("clientName is required.");
  });

  it("returns 422 with code buyerAddressMissing when finalizing without a complete buyer address", async () => {
    authOk("user-1");
    mockUpdate.mockResolvedValue({ ok: false, reason: "buyer_address_missing" });
    const response = await PATCH(
      req("PATCH", "inv-1", { clientName: "X", status: "unpaid" }),
      params("inv-1")
    );
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("buyerAddressMissing");
  });

  it("returns 200 with the updated draft invoice", async () => {
    authOk("user-1");
    const updated = makeInvoice({ id: "inv-1", clientName: "Updated Kft.", status: "draft" });
    mockUpdate.mockResolvedValue({ ok: true, invoice: updated });
    const response = await PATCH(
      req("PATCH", "inv-1", { clientName: "Updated Kft.", lineItems: [] }),
      params("inv-1")
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.invoice.clientName).toBe("Updated Kft.");
    expect(mockUpdate).toHaveBeenCalledWith("user-1", "inv-1", expect.objectContaining({ clientName: "Updated Kft." }));
  });
});

describe("DELETE /api/v1/invoices/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    authFail();
    const response = await DELETE(req("DELETE", "inv-1"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk("user-1");
    mockDelete.mockResolvedValue("not_found");
    const response = await DELETE(req("DELETE", "missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns 409 with code notDraft for a finalized invoice, never deleting it", async () => {
    authOk("user-1");
    mockDelete.mockResolvedValue("not_draft");
    const response = await DELETE(req("DELETE", "inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe("notDraft");
  });

  it("returns 204 after deleting a draft", async () => {
    authOk("user-1");
    mockDelete.mockResolvedValue("deleted");
    const response = await DELETE(req("DELETE", "inv-1"), params("inv-1"));
    expect(response.status).toBe(204);
  });
});
