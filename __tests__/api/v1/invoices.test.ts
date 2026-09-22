// __tests__/api/v1/invoices.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/create-from-payload", () => ({
  createInvoiceFromPayload: jest.fn(),
}));

jest.mock("@/lib/invoices/send-invoice-email", () => ({
  sendInvoiceNotificationEmail: jest.fn(),
}));

jest.mock("@/lib/nav/submit-outgoing", () => ({
  submitOutgoingInvoiceToNav: jest.fn(),
}));

jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: jest.fn(),
  toNavAutoSubmitResult: jest.fn((outcome: { kind: string }) => ({ outcome: outcome.kind, submission: null })),
}));

jest.mock("@/lib/invoices/service", () => {
  // Mirrors the real class's shape so `e instanceof CompanyProfileIncompleteError`
  // in the route works against an error built with the SAME (mocked)
  // export from a test in this file.
  class CompanyProfileIncompleteError extends Error {
    missingFields: string[];
    constructor(missingFields: string[]) {
      super("Company profile is incomplete.");
      this.name = "CompanyProfileIncompleteError";
      this.missingFields = missingFields;
    }
  }
  return {
    listInvoices: jest.fn(),
    CompanyProfileIncompleteError,
  };
});

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

import { GET, POST } from "@/app/api/v1/invoices+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { createInvoiceFromPayload } from "@/lib/invoices/create-from-payload";
import { BuyerAddressMissingError } from "@/lib/invoices/errors";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { CompanyProfileIncompleteError, listInvoices } from "@/lib/invoices/service";
import { withIdempotency } from "@/lib/api/idempotency";
import { autoSubmitToNavOnFinalize } from "@/lib/nav/auto-submit";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockCreate = createInvoiceFromPayload as jest.MockedFunction<typeof createInvoiceFromPayload>;
const mockSendEmail = sendInvoiceNotificationEmail as jest.MockedFunction<
  typeof sendInvoiceNotificationEmail
>;
const mockListInvoices = listInvoices as jest.MockedFunction<typeof listInvoices>;
const mockWithIdempotency = withIdempotency as jest.MockedFunction<typeof withIdempotency>;
const mockAutoSubmit = autoSubmitToNavOnFinalize as jest.MockedFunction<typeof autoSubmitToNavOnFinalize>;
const mockSubmit = submitOutgoingInvoiceToNav as jest.MockedFunction<typeof submitOutgoingInvoiceToNav>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({
    ok: true,
    userId,
    apiKey: {
      id: "key-1",
      userId,
      name: "Test",
      publicKey: "pk",
      enabled: true,
      lastUsedAt: null,
      createdAt: "",
      updatedAt: "",
    },
  } as never);
}

describe("GET /api/v1/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without a valid API key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);

    const response = await GET(new Request("http://localhost/api/v1/invoices"));
    expect(response.status).toBe(401);
  });

  it("passes status/search/limit/offset through to listInvoices, scoped to the key's userId", async () => {
    authOk("user-1");
    mockListInvoices.mockResolvedValue({
      invoices: [makeInvoice({ id: "inv-1" })],
      total: 1,
      limit: 10,
      offset: 0,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/v1/invoices?status=sent&search=acme&limit=10&offset=0"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoices).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(mockListInvoices).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: "sent", search: "acme", limit: 10, offset: 0 })
    );
  });
});

describe("POST /api/v1/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authOk("user-1");
    mockCreate.mockImplementation(async (_userId, body) =>
      makeInvoice({ id: "inv-1", clientName: body.clientName })
    );
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("auto-submits the created (final) invoice to NAV and returns navSubmission", async () => {
    mockAutoSubmit.mockResolvedValue({
      outcome: "submitted",
      submission: { submissionId: "sub-1", status: "sent", mode: "demo", transactionId: "TX-1", errorMessage: null },
    });
    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", sendEmail: false }),
      })
    );
    const body = await response.json();
    expect(mockAutoSubmit).toHaveBeenCalledWith("user-1", null, expect.objectContaining({ id: "inv-1" }));
    expect(body.navSubmission.transactionId).toBe("TX-1");
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("auto-submits the invoice as finalized by the email step (a draft body is finalized there)", async () => {
    const finalized = makeInvoice({ id: "inv-1", status: "sent", invoiceNumber: "INV-2026-009" });
    mockSendEmail.mockResolvedValue({ ok: true, invoice: finalized } as never);
    await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", status: "draft", sendEmail: true }),
      })
    );
    expect(mockAutoSubmit).toHaveBeenCalledWith("user-1", null, finalized);
  });

  it("does NOT e-mail (or finalize) by default when sendEmail is omitted", async () => {
    const draft = makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" });
    mockCreate.mockResolvedValue(draft);
    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }] }),
      })
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(body.email).toEqual({ sent: false, skipped: true });
    expect(body.invoice.status).toBe("draft");
    expect(body.invoice.invoiceNumber).toBe("");
    expect(mockAutoSubmit).toHaveBeenCalledWith("user-1", null, draft);
  });

  it("still finalizes and e-mails when sendEmail is explicitly true", async () => {
    const finalized = makeInvoice({ id: "inv-1", status: "sent", invoiceNumber: "INV-2026-010" });
    mockSendEmail.mockResolvedValue({ ok: true, invoice: finalized, to: ["a@b.hu"], cc: [], pdfAttached: true } as never);
    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", sendEmail: true, emailTo: "a@b.hu" }),
      })
    );
    const body = await response.json();
    expect(mockSendEmail).toHaveBeenCalledWith("user-1", "inv-1", expect.objectContaining({ markSent: true, to: "a@b.hu" }));
    expect(body.invoice.invoiceNumber).toBe("INV-2026-010");
    expect(body.email.sent).toBe(true);
  });

  it("still honours an explicit submitToNav when auto-submit didn't apply", async () => {
    mockSubmit.mockResolvedValue({ kind: "rejected", code: "draftNotSubmittable", httpStatus: 409 } as never);
    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", sendEmail: false, submitToNav: true }),
      })
    );
    const body = await response.json();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(body.nav.outcome).toBe("rejected");
  });

  it("returns 401 without a valid API key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("creates an invoice and skips NAV/email when not requested", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }],
          sendEmail: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.invoice.clientName).toBe("Acme Kft.");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 422 with code companyProfileIncomplete instead of a generic 400 (create-with-finalize)", async () => {
    mockCreate.mockRejectedValue(
      new CompanyProfileIncompleteError(["taxNumber", "zipCode", "city", "address"])
    );

    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }],
          status: "sent",
          sendEmail: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("companyProfileIncomplete");
    expect(body.missingFields).toEqual(["taxNumber", "zipCode", "city", "address"]);
  });

  it("routes the request through withIdempotency using the parsed body", async () => {
    await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        headers: { "Idempotency-Key": "abc-123" },
        body: JSON.stringify({
          clientName: "Acme Kft.",
          lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }],
          sendEmail: false,
        }),
      })
    );

    expect(mockWithIdempotency).toHaveBeenCalledTimes(1);
    const [, userId, requestBody] = mockWithIdempotency.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(requestBody).toMatchObject({ clientName: "Acme Kft." });
  });

  it("returns 422 with code buyerAddressMissing when the buyer address is incomplete for a finalized create", async () => {
    mockCreate.mockRejectedValue(new BuyerAddressMissingError());

    const response = await POST(
      new Request("http://localhost/api/v1/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          lineItems: [{ description: "x", quantity: 1, unitPrice: 100 }],
          status: "sent",
          sendEmail: false,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("buyerAddressMissing");
  });
});
