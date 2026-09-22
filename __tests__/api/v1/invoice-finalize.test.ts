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
  upsertInvoice: jest.fn(),
}));

jest.mock("@/lib/invoices/exchange-rate-autofill", () => ({
  autofillMissingExchangeRate: jest.fn(),
}));

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

const mockAutoSubmit = jest.fn();
jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: (...args: unknown[]) => mockAutoSubmit(...args),
}));

import { POST } from "@/app/api/v1/invoices/[id]/finalize+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { finalizeInvoice, upsertInvoice } from "@/lib/invoices/service";
import { autofillMissingExchangeRate } from "@/lib/invoices/exchange-rate-autofill";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockFinalize = finalizeInvoice as jest.MockedFunction<typeof finalizeInvoice>;
const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;
const mockAutofill = autofillMissingExchangeRate as jest.MockedFunction<
  typeof autofillMissingExchangeRate
>;

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoSubmit.mockResolvedValue(null);
  });

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

  it("returns 422 with code companyProfileIncomplete when the seller profile is missing required fields", async () => {
    authOk();
    mockFinalize.mockResolvedValue({
      ok: false,
      reason: "company_profile_incomplete",
      missingFields: ["taxNumber", "address"],
    });
    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("companyProfileIncomplete");
    expect(body.missingFields).toEqual(["taxNumber", "address"]);
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

  it("auto-submits the finalized invoice to NAV and returns the result", async () => {
    authOk("user-1");
    const finalized = makeInvoice({ id: "inv-1", status: "unpaid", invoiceNumber: "INV-2026-00008" });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });
    mockAutoSubmit.mockResolvedValue({ outcome: "submitted", submission: { submissionId: "s1" } });

    const body = await (await POST(req("inv-1"), params("inv-1"))).json();

    expect(mockAutoSubmit).toHaveBeenCalledWith("user-1", null, finalized);
    expect(body.nav.outcome).toBe("submitted");
  });

  it("never submits when finalization was refused", async () => {
    authOk();
    mockFinalize.mockResolvedValue({ ok: false, reason: "not_draft" });
    await POST(req("inv-1"), params("inv-1"));
    expect(mockAutoSubmit).not.toHaveBeenCalled();
  });

  it("submits to NAV only after the MNB safety net filled in the rate", async () => {
    authOk("user-1");
    const finalized = makeInvoice({ id: "inv-1", status: "unpaid", currency: "EUR", exchangeRate: undefined });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });
    mockAutofill.mockResolvedValue(397.5);
    mockUpsert.mockResolvedValue({ ...finalized, exchangeRate: 397.5 });

    await POST(req("inv-1"), params("inv-1"));

    expect(mockAutoSubmit).toHaveBeenCalledWith(
      "user-1",
      null,
      expect.objectContaining({ id: "inv-1", exchangeRate: 397.5 })
    );
  });

  it("auto-fills the MNB rate when finalizing leaves a non-HUF invoice with no rate", async () => {
    authOk("user-1");
    const finalized = makeInvoice({
      id: "inv-1",
      status: "unpaid",
      currency: "EUR",
      exchangeRate: undefined,
    });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });
    mockAutofill.mockResolvedValue(397.5);
    mockUpsert.mockResolvedValue({ ...finalized, exchangeRate: 397.5 });

    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.exchangeRate).toBe(397.5);
    expect(mockUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ id: "inv-1", exchangeRate: 397.5 })
    );
  });

  it("never calls the autofill helper for a HUF invoice", async () => {
    authOk("user-1");
    const finalized = makeInvoice({ id: "inv-1", status: "unpaid", currency: "HUF" });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });

    await POST(req("inv-1"), params("inv-1"));

    expect(mockAutofill).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("leaves the invoice as-is when MNB returns nothing (existing banner fallback)", async () => {
    authOk("user-1");
    const finalized = makeInvoice({
      id: "inv-1",
      status: "unpaid",
      currency: "EUR",
      exchangeRate: undefined,
    });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });
    mockAutofill.mockResolvedValue(undefined);

    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.exchangeRate).toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("never re-fetches when the finalized invoice already has a valid rate", async () => {
    authOk("user-1");
    const finalized = makeInvoice({
      id: "inv-1",
      status: "unpaid",
      currency: "EUR",
      exchangeRate: 390.5,
    });
    mockFinalize.mockResolvedValue({ ok: true, invoice: finalized });

    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.exchangeRate).toBe(390.5);
    expect(mockAutofill).not.toHaveBeenCalled();
  });
});
