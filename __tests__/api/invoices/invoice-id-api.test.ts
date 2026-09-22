// __tests__/api/invoices/invoice-id-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => {
  // Mirrors the real class's shape so `error instanceof CompanyProfileIncompleteError`
  // in the route works against an error constructed with THIS (mocked) export.
  class CompanyProfileIncompleteError extends Error {
    missingFields: string[];
    constructor(missingFields: string[]) {
      super("Company profile is incomplete.");
      this.name = "CompanyProfileIncompleteError";
      this.missingFields = missingFields;
    }
  }
  return {
    getInvoiceById: jest.fn(),
    upsertInvoice: jest.fn(),
    deleteDraftInvoiceById: jest.fn(),
    CompanyProfileIncompleteError,
  };
});

import { requireSession } from "@/lib/api/session";
import { DELETE, GET, PATCH } from "@/app/api/invoices/[id]+api";
import {
  CompanyProfileIncompleteError,
  deleteDraftInvoiceById,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;
const mockDeleteDraft = deleteDraftInvoiceById as jest.MockedFunction<typeof deleteDraftInvoiceById>;

function patchRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new Request(`http://localhost/api/invoices/${id}`, { method: "DELETE" });
}

describe("GET /api/invoices/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/invoices/x"), {
      params: { id: "x" },
    });
    expect(response.status).toBe(401);
  });

  it("returns invoice json", async () => {
    const invoice = makeInvoice({ id: "inv-1" });
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(invoice);

    const response = await GET(new Request("http://localhost/api/invoices/inv-1"), {
      params: { id: "inv-1" },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.invoice.id).toBe("inv-1");
  });

  it("returns 404 when missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/invoices/missing"), {
      params: { id: "missing" },
    });
    expect(response.status).toBe(404);
  });

  it("handles undefined params safely", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await GET(new Request("http://localhost/api/invoices"), {});
    expect(response.status).toBe(400);
  });

  it("resolves id from request URL when params are missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/invoices/mr682pvd-ketybxz3p"),
      {}
    );
    expect(mockGet).toHaveBeenCalledWith("user-1", "mr682pvd-ketybxz3p");
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/invoices/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await PATCH(patchRequest("inv-1", { clientName: "X" }), {
      params: { id: "inv-1" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the invoice doesn't exist", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);
    const response = await PATCH(patchRequest("missing", { clientName: "X" }), {
      params: { id: "missing" },
    });
    expect(response.status).toBe(404);
  });

  it("returns 409 with code invoiceFinalized for a non-draft invoice, never calling upsertInvoice", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1", status: "sent" }));

    const response = await PATCH(patchRequest("inv-1", { clientName: "Changed" }), {
      params: { id: "inv-1" },
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("invoiceFinalized");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("updates a draft invoice", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const draft = makeInvoice({ id: "inv-1", status: "draft", clientName: "Old" });
    mockGet.mockResolvedValue(draft);
    mockUpsert.mockImplementation((_uid, inv) => Promise.resolve(inv));

    const response = await PATCH(patchRequest("inv-1", { clientName: "New" }), {
      params: { id: "inv-1" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.clientName).toBe("New");
  });

  it("still allows a draft PATCH to finalize (status moves off draft) — the guard only blocks an already-finalized invoice", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const draft = makeInvoice({ id: "inv-1", status: "draft" });
    mockGet.mockResolvedValue(draft);
    mockUpsert.mockImplementation((_uid, inv) => Promise.resolve(inv));

    const response = await PATCH(patchRequest("inv-1", { status: "unpaid" }), {
      params: { id: "inv-1" },
    });

    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: "unpaid" })
    );
  });

  it("returns 422 with code companyProfileIncomplete when finalizing would need an incomplete profile", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const draft = makeInvoice({ id: "inv-1", status: "draft" });
    mockGet.mockResolvedValue(draft);
    mockUpsert.mockRejectedValue(
      new CompanyProfileIncompleteError(["taxNumber", "zipCode", "city", "address"])
    );

    const response = await PATCH(patchRequest("inv-1", { status: "unpaid" }), {
      params: { id: "inv-1" },
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("companyProfileIncomplete");
    expect(body.missingFields).toEqual(["taxNumber", "zipCode", "city", "address"]);
  });
});

describe("DELETE /api/invoices/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await DELETE(deleteRequest("inv-1"), { params: { id: "inv-1" } });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the invoice doesn't exist", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteDraft.mockResolvedValue("not_found");
    const response = await DELETE(deleteRequest("missing"), { params: { id: "missing" } });
    expect(response.status).toBe(404);
  });

  it("returns 409 with code invoiceFinalized for a non-draft invoice, never deleting it", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteDraft.mockResolvedValue("not_draft");
    const response = await DELETE(deleteRequest("inv-1"), { params: { id: "inv-1" } });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("invoiceFinalized");
  });

  it("deletes a draft invoice and returns 204", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockDeleteDraft.mockResolvedValue("deleted");
    const response = await DELETE(deleteRequest("inv-1"), { params: { id: "inv-1" } });
    expect(response.status).toBe(204);
  });
});
