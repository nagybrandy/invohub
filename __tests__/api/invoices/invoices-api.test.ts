// __tests__/api/invoices/invoices-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  listInvoices: jest.fn(),
  getInvoiceStats: jest.fn(),
  upsertInvoice: jest.fn(),
  findLiveConversionsForProformas: jest.fn(),
}));

const mockAutoSubmit = jest.fn();
jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: (...args: unknown[]) => mockAutoSubmit(...args),
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
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("persists the partner link (clientId) so NAV can read the buyer address", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", clientId: "cl-1", lineItems: [] }),
      })
    );
    expect(mockUpsert.mock.calls[0][1].clientId).toBe("cl-1");
  });

  it("runs NAV auto-submit on the saved invoice (new document: before = null) and returns its result", async () => {
    const nav = { outcome: "submitted", submission: { submissionId: "s1", status: "sent" } };
    mockAutoSubmit.mockResolvedValue(nav);
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", status: "unpaid", invoiceNumber: "INV-2026-001", lineItems: [] }),
      })
    );
    const body = await response.json();
    expect(mockAutoSubmit).toHaveBeenCalledWith("user-1", null, expect.objectContaining({ status: "unpaid" }));
    expect(body.nav).toEqual(nav);
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
