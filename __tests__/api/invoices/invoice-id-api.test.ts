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

jest.mock("@/lib/invoices/exchange-rate-autofill", () => ({
  autofillMissingExchangeRate: jest.fn(),
}));

const mockAutoSubmit = jest.fn();
jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: (...args: unknown[]) => mockAutoSubmit(...args),
}));

import { requireSession } from "@/lib/api/session";
import { DELETE, GET, PATCH } from "@/app/api/invoices/[id]+api";
import {
  CompanyProfileIncompleteError,
  deleteDraftInvoiceById,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";
import { autofillMissingExchangeRate } from "@/lib/invoices/exchange-rate-autofill";
import { InvoiceAlreadyFinalizedError } from "@/lib/invoices/errors";
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

const mockAutofill = autofillMissingExchangeRate as jest.MockedFunction<
  typeof autofillMissingExchangeRate
>;

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
    const draft = makeInvoice({
      id: "inv-1",
      status: "draft",
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
    });
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
    const draft = makeInvoice({
      id: "inv-1",
      status: "draft",
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
    });
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

  it("returns 409 invoiceFinalized (not 500) when a concurrent request finalized the same draft first", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(
      makeInvoice({
        id: "inv-1",
        status: "draft",
        invoiceNumber: "",
        clientZipCode: "1011",
        clientCity: "Budapest",
        clientAddress: "Fő utca 1.",
      })
    );
    mockUpsert.mockRejectedValue(new InvoiceAlreadyFinalizedError("INV-2026-00001"));

    const response = await PATCH(patchRequest("inv-1", { status: "unpaid" }), {
      params: { id: "inv-1" },
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("invoiceFinalized");
    // The loser of the race must never report its own finalize to NAV.
    expect(mockAutoSubmit).not.toHaveBeenCalled();
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

describe("PATCH /api/invoices/[id] — MNB safety net", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockImplementation(async (_userId, invoice) => invoice as never);
  });

  function patch(id: string, body: unknown) {
    return PATCH(
      new Request(`http://localhost/api/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: { id } }
    );
  }

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await patch("inv-1", {});
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    mockGet.mockResolvedValue(null);
    const response = await patch("missing", {});
    expect(response.status).toBe(404);
  });

  function patchRequest(body: unknown) {
    return new Request("http://localhost/api/invoices/inv-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  it("allows a draft update with no buyer address", async () => {
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft" }));
    const response = await PATCH(patchRequest({ status: "draft" }), {
      params: { id: "inv-1" },
    });
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("rejects finalizing (status !== draft) without a complete buyer address with 422 buyerAddressMissing", async () => {
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft" }));
    const response = await PATCH(patchRequest({ status: "unpaid" }), {
      params: { id: "inv-1" },
    });
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("buyerAddressMissing");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("allows finalizing (status !== draft) once the buyer address is complete", async () => {
    mockGet.mockResolvedValue(
      makeInvoice({
        id: "inv-1",
        status: "draft",
        clientZipCode: "1011",
        clientCity: "Budapest",
        clientAddress: "Fő utca 1.",
      })
    );
    const response = await PATCH(patchRequest({ status: "unpaid" }), {
      params: { id: "inv-1" },
    });
    expect(response.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("auto-fills the MNB rate when a PATCH finalizes (or edits) a non-HUF invoice with no rate", async () => {
    mockGet.mockResolvedValue(
      makeInvoice({ id: "inv-1", status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1.", currency: "EUR", exchangeRate: undefined })
    );
    mockAutofill.mockResolvedValue(397.5);

    const response = await patch("inv-1", { status: "unpaid" });

    expect(response.status).toBe(200);
    expect(mockAutofill).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "EUR", exchangeRate: undefined })
    );
    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBe(397.5);
  });

  it("fetches the rate for the draft's persisted fulfillment date when finalizing (Áfa tv. 80. §)", async () => {
    mockGet.mockResolvedValue(
      makeInvoice({ id: "inv-1", status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1.", currency: "EUR", exchangeRate: undefined, issueDate: "2026-09-22", fulfillmentDate: "2026-09-15" })
    );
    mockAutofill.mockResolvedValue(398.1);

    await patch("inv-1", { status: "unpaid" });

    expect(mockAutofill).toHaveBeenCalledWith(
      expect.objectContaining({ issueDate: "2026-09-22", fulfillmentDate: "2026-09-15" })
    );
  });

  it("never overrides an already-valid manual rate", async () => {
    mockGet.mockResolvedValue(
      makeInvoice({ id: "inv-1", status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1.", currency: "EUR", exchangeRate: 390.5 })
    );

    const response = await patch("inv-1", { status: "unpaid" });

    expect(response.status).toBe(200);
    expect(mockAutofill).not.toHaveBeenCalled();
    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBe(390.5);
  });

  it("never calls the autofill helper for a HUF invoice", async () => {
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft", currency: "HUF" }));

    await patch("inv-1", { status: "unpaid" });

    expect(mockAutofill).not.toHaveBeenCalled();
  });

  it("leaves exchangeRate undefined (existing banner fallback) when MNB returns nothing", async () => {
    mockGet.mockResolvedValue(
      makeInvoice({ id: "inv-1", status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1.", currency: "EUR", exchangeRate: undefined })
    );
    mockAutofill.mockResolvedValue(undefined);

    const response = await patch("inv-1", { status: "unpaid" });

    expect(response.status).toBe(200);
    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });
});

describe("PATCH /api/invoices/[id] — NAV auto-submit on finalization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockImplementation(async (_userId, invoice) => ({ ...invoice, invoiceNumber: "INV-2026-005" }) as never);
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("passes the pre-save invoice as `before` so only a draft -> final transition submits", async () => {
    const draft = makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    mockGet.mockResolvedValue(draft);

    const response = await PATCH(
      new Request("http://localhost/api/invoices/inv-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "unpaid" }),
      }),
      { params: { id: "inv-1" } }
    );

    expect(response.status).toBe(200);
    expect(mockAutoSubmit).toHaveBeenCalledWith(
      "user-1",
      draft,
      expect.objectContaining({ status: "unpaid", invoiceNumber: "INV-2026-005" })
    );
  });

  it("returns the NAV result next to the invoice", async () => {
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." }));
    mockAutoSubmit.mockResolvedValue({ outcome: "failed", submission: null, error: "boom" });

    const response = await PATCH(
      new Request("http://localhost/api/invoices/inv-1", { method: "PATCH", body: JSON.stringify({ status: "unpaid" }) }),
      { params: { id: "inv-1" } }
    );
    expect((await response.json()).nav).toEqual({ outcome: "failed", submission: null, error: "boom" });
  });
});
