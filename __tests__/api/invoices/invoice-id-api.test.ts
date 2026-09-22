// __tests__/api/invoices/invoice-id-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  upsertInvoice: jest.fn(),
  deleteInvoiceById: jest.fn(),
}));

jest.mock("@/lib/invoices/exchange-rate-autofill", () => ({
  autofillMissingExchangeRate: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { GET, PATCH } from "@/app/api/invoices/[id]+api";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import { autofillMissingExchangeRate } from "@/lib/invoices/exchange-rate-autofill";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;
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
