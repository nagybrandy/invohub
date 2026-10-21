// POST /api/invoices builds the Invoice from selected body fields — a field
// not copied there is silently lost. The document language was exactly that.
/** @jest-environment node */
const mockUpsert = jest.fn(async (_userId: string, invoice: unknown) => invoice);

jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(async () => ({ user: { id: "u1" } })),
  unauthorizedResponse: jest.fn(() => new Response("{}", { status: 401 })),
  jsonResponse: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
}));
jest.mock("@/lib/invoices/service", () => ({
  CompanyProfileIncompleteError: class extends Error {},
  findLiveConversionsForProformas: jest.fn(),
  getInvoiceById: jest.fn(async () => null),
  getInvoiceStats: jest.fn(),
  listInvoices: jest.fn(),
  upsertInvoice: (userId: string, invoice: unknown) => mockUpsert(userId, invoice),
}));
jest.mock("@/lib/invoices/exchange-rate-autofill", () => ({
  autofillMissingExchangeRate: jest.fn(async ({ exchangeRate }: { exchangeRate?: number }) => exchangeRate),
}));
jest.mock("@/lib/nav/auto-submit", () => ({ autoSubmitToNavOnFinalize: jest.fn(async () => null) }));

import { POST } from "@/app/api/invoices+api";

function post(body: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/invoices", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/invoices", () => {
  beforeEach(() => mockUpsert.mockClear());

  it("keeps a valid document language and per-line remark", async () => {
    const res = await post({
      status: "draft", clientName: "Nordic Trade Bt.", currency: "HUF", language: "en",
      lineItems: [{ id: "l1", description: "Consulting", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal", comment: "Project Alpha" }],
    });
    expect(res.status).toBe(201);
    const saved = mockUpsert.mock.calls[0][1] as { language?: string; lineItems: Array<{ comment?: string }> };
    expect(saved.language).toBe("en");
    expect(saved.lineItems[0].comment).toBe("Project Alpha");
  });

  it("drops a language it does not know", async () => {
    await post({ status: "draft", clientName: "X", currency: "HUF", language: "klingon", lineItems: [] });
    expect((mockUpsert.mock.calls[0][1] as { language?: string }).language).toBeUndefined();
  });
});
