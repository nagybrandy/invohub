// __tests__/api/nav/submit.test.ts
// POST /api/nav/submit refuses in-language, before any NAV call, when the
// invoice has no usable HUF exchange rate (plan
// docs/plans/2026-09-18-backfill-non-huf-invoices-missing-exchange-rate.md AC7),
// refuses drafts/díjbekérők with stable codes, and is idempotent.
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

jest.mock("@/lib/nav/submit-outgoing", () => ({
  submitOutgoingInvoiceToNav: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { getInvoiceById } from "@/lib/invoices/service";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";
import { POST } from "@/app/api/nav/submit+api";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoiceById = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockSubmit = submitOutgoingInvoiceToNav as jest.MockedFunction<
  typeof submitOutgoingInvoiceToNav
>;

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/nav/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    invoiceId: "inv-1",
    status: "sent",
    mode: "demo",
    transactionId: "TX-1",
    errorMessage: null,
    messages: null,
    checkedAt: null,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("POST /api/nav/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSubmit.mockResolvedValue({
      kind: "submitted",
      submission: submissionRow({ status: "sent" }),
      invoiceXml: "<x/>",
    } as never);
  });

  it("returns 409 with code missingExchangeRate for a EUR invoice with no rate (AC7.1)", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: undefined }) as never
    );

    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("missingExchangeRate");
    expect(typeof body.error).toBe("string");
  });

  it("never calls submitOutgoingInvoiceToNav when the rate is missing (AC7.2)", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: 0 }) as never
    );

    await POST(makeRequest({ invoiceId: "inv-1" }));

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("submits normally for a EUR invoice with a valid rate (AC7.3)", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: 390.5 }) as never
    );

    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.submission.transactionId).toBe("TX-1");
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits normally for a HUF invoice (AC7.4)", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ id: "inv-1", currency: "HUF", exchangeRate: undefined }) as never
    );

    const res = await POST(makeRequest({ invoiceId: "inv-1" }));

    expect(res.status).toBe(200);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the invoice is not found", async () => {
    mockGetInvoiceById.mockResolvedValue(null);
    const res = await POST(makeRequest({ invoiceId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("refuses a draft with 409 draftNotSubmittable and never submits", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ status: "draft", invoiceNumber: "" }) as never);
    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("draftNotSubmittable");
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("refuses a díjbekérő with 422 proformaNotSubmittable and never submits", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ documentType: "proforma", status: "proforma", invoiceNumber: "DBK-2026-001" }) as never
    );
    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("proformaNotSubmittable");
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("returns the existing in-progress/done submission (200, alreadySubmitted) instead of submitting again", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1" }) as never);
    mockSubmit.mockResolvedValue({
      kind: "existing",
      submission: submissionRow({ id: "sub-old", status: "done", transactionId: "TX-OLD" }),
    } as never);

    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadySubmitted).toBe(true);
    expect(body.submission).toMatchObject({ submissionId: "sub-old", status: "done", transactionId: "TX-OLD" });
  });

  it("answers a recorded NAV failure with 502 navSubmitFailed and the failed submission", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1" }) as never);
    mockSubmit.mockResolvedValue({
      kind: "failed",
      submission: submissionRow({ status: "error", transactionId: null, errorMessage: "boom" }),
      error: "boom",
    } as never);

    const res = await POST(makeRequest({ invoiceId: "inv-1" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("navSubmitFailed");
    expect(body.error).toBe("boom");
    expect(body.submission.status).toBe("error");
  });
});
