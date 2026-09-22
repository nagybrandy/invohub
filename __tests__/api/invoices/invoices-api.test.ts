// __tests__/api/invoices/invoices-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
  getInvoiceStats: jest.fn(),
  upsertInvoice: jest.fn(),
  findLiveConversionsForProformas: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { GET, POST } from "@/app/api/invoices+api";
import {
  findLiveConversionsForProformas,
  getInvoiceStats,
  listInvoices,
  upsertInvoice,
} from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;
const mockListInvoices = listInvoices as jest.MockedFunction<typeof listInvoices>;
const mockGetStats = getInvoiceStats as jest.MockedFunction<typeof getInvoiceStats>;
const mockFindLiveConversions = findLiveConversionsForProformas as jest.MockedFunction<
  typeof findLiveConversionsForProformas
>;

describe("POST /api/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockImplementation(async (_userId, invoice) => invoice as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("passes exchangeRate through for a non-HUF invoice (AC10)", async () => {
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          currency: "EUR",
          exchangeRate: 390.5,
          lineItems: [],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBe(390.5);
  });

  it("drops exchangeRate for a HUF invoice even when the body carries one (AC10)", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          currency: "HUF",
          exchangeRate: 390.5,
          lineItems: [],
        }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });

  it("drops a non-positive or non-numeric exchangeRate even for a non-HUF invoice", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          currency: "EUR",
          exchangeRate: 0,
          lineItems: [],
        }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });

  it("defaults currency to HUF and omits exchangeRate when the body carries neither", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", lineItems: [] }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.currency).toBe("HUF");
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });

  it("passes the buyer address snapshot fields through for a draft (Áfa tv. 169. § e)", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          clientZipCode: "1011",
          clientCity: "Budapest",
          clientAddress: "Fő utca 1.",
          clientCountry: "Magyarország",
          clientEuVatNumber: "HU12345678",
          lineItems: [],
        }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.clientZipCode).toBe("1011");
    expect(savedInvoice.clientCity).toBe("Budapest");
    expect(savedInvoice.clientAddress).toBe("Fő utca 1.");
    expect(savedInvoice.clientCountry).toBe("Magyarország");
    expect(savedInvoice.clientEuVatNumber).toBe("HU12345678");
  });

  it("allows a draft with no buyer address at all", async () => {
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", lineItems: [], status: "draft" }),
      })
    );
    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("rejects finalizing (status !== draft) without a complete buyer address with 422 buyerAddressMissing", async () => {
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          lineItems: [{ id: "l1", description: "X", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" }],
          status: "unpaid",
        }),
      })
    );
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("buyerAddressMissing");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("never requires a buyer address for a proforma (díjbekérő) — not an accounting document", async () => {
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          documentType: "proforma",
          lineItems: [{ id: "l1", description: "X", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" }],
          status: "proforma",
        }),
      })
    );
    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("allows finalizing (status !== draft) once the buyer address is complete", async () => {
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          clientZipCode: "1011",
          clientCity: "Budapest",
          clientAddress: "Fő utca 1.",
          lineItems: [{ id: "l1", description: "X", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" }],
          status: "unpaid",
        }),
      })
    );
    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetStats.mockResolvedValue({ count: 0, thisMonthCount: 0, monthlyTotal: 0 });
  });

  function request(url = "http://localhost/api/invoices") {
    return new Request(url);
  }

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
  });

  it("includes convertedProformaIds computed only from the proforma rows on the page (AC12)", async () => {
    const proforma1 = makeInvoice({ id: "proforma-1", documentType: "proforma" });
    const proforma2 = makeInvoice({ id: "proforma-2", documentType: "proforma" });
    const invoiceRow = makeInvoice({ id: "inv-1", documentType: "invoice" });
    mockListInvoices.mockResolvedValue({
      invoices: [proforma1, proforma2, invoiceRow],
      total: 3,
      limit: 25,
      offset: 0,
    });
    mockFindLiveConversions.mockResolvedValue({ "proforma-1": "converted-inv-1" });

    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.convertedProformaIds).toEqual({ "proforma-1": "converted-inv-1" });
    expect(mockFindLiveConversions).toHaveBeenCalledWith("user-1", ["proforma-1", "proforma-2"]);
  });

  it("passes an empty array (no DB query per AC11) when the page has no proforma rows", async () => {
    const invoiceRow = makeInvoice({ id: "inv-1", documentType: "invoice" });
    mockListInvoices.mockResolvedValue({
      invoices: [invoiceRow],
      total: 1,
      limit: 25,
      offset: 0,
    });
    mockFindLiveConversions.mockResolvedValue({});

    const response = await GET(request());

    const body = await response.json();
    expect(body.convertedProformaIds).toEqual({});
    expect(mockFindLiveConversions).toHaveBeenCalledWith("user-1", []);
  });

  it("passes needsExchangeRate: true to listInvoices when ?needsExchangeRate=1 (AC2.6)", async () => {
    mockListInvoices.mockResolvedValue({ invoices: [], total: 0, limit: 25, offset: 0 });
    mockFindLiveConversions.mockResolvedValue({});

    await GET(request("http://localhost/api/invoices?needsExchangeRate=1"));

    expect(mockListInvoices).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ needsExchangeRate: true })
    );
  });

  it("omits needsExchangeRate from listInvoices when the query param is absent (AC2.6)", async () => {
    mockListInvoices.mockResolvedValue({ invoices: [], total: 0, limit: 25, offset: 0 });
    mockFindLiveConversions.mockResolvedValue({});

    await GET(request());

    const [, options] = mockListInvoices.mock.calls[0];
    expect((options as { needsExchangeRate?: boolean }).needsExchangeRate).toBeUndefined();
  });
});
