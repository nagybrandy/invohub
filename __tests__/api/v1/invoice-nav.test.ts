// __tests__/api/v1/invoice-nav.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

jest.mock("@/lib/nav/list-submissions", () => ({
  listNavSubmissionsForInvoice: jest.fn(),
}));

jest.mock("@/lib/nav/submit-outgoing", () => ({
  submitOutgoingInvoiceToNav: jest.fn(),
}));

import { GET, POST } from "@/app/api/v1/invoices/[id]/nav+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { getInvoiceById } from "@/lib/invoices/service";
import { listNavSubmissionsForInvoice } from "@/lib/nav/list-submissions";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockList = listNavSubmissionsForInvoice as jest.MockedFunction<typeof listNavSubmissionsForInvoice>;
const mockSubmit = submitOutgoingInvoiceToNav as jest.MockedFunction<typeof submitOutgoingInvoiceToNav>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/invoices/[id]/nav", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await GET(new Request("http://localhost/api/v1/invoices/inv-1/nav"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk();
    mockGet.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/invoices/missing/nav"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns the invoice's NAV submissions", async () => {
    authOk("user-1");
    const invoice = makeInvoice({ id: "inv-1" });
    mockGet.mockResolvedValue(invoice);
    mockList.mockResolvedValue([{ id: "sub-1", invoiceId: "inv-1", status: "done" } as never]);

    const response = await GET(new Request("http://localhost/api/v1/invoices/inv-1/nav"), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.submissions).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith("inv-1");
  });
});

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    invoiceId: "inv-1",
    status: "sent",
    mode: "demo",
    transactionId: "TX-1",
    errorMessage: null,
    messages: null,
    checkedAt: null,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

async function post(id = "inv-1") {
  return POST(new Request(`http://localhost/api/v1/invoices/${id}/nav`, { method: "POST" }), params(id));
}

describe("POST /api/v1/invoices/[id]/nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authOk("user-1");
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1" }));
  });

  it("submits to NAV and returns navSubmission", async () => {
    mockSubmit.mockResolvedValue({ kind: "submitted", submission: row(), invoiceXml: "<x/>" } as never);
    const response = await post();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.navSubmission).toMatchObject({ submissionId: "sub-1", transactionId: "TX-1" });
  });

  it("returns the existing submission (alreadySubmitted) instead of re-submitting", async () => {
    mockSubmit.mockResolvedValue({ kind: "existing", submission: row({ status: "done" }) } as never);
    const body = await (await post()).json();
    expect(body.alreadySubmitted).toBe(true);
    expect(body.navSubmission.status).toBe("done");
  });

  it("refuses a draft/proforma with the guard's status and stable code", async () => {
    mockSubmit.mockResolvedValue({ kind: "rejected", code: "proformaNotSubmittable", httpStatus: 422 } as never);
    const response = await post();
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("proformaNotSubmittable");
  });

  it("returns 502 navSubmitFailed for a recorded NAV failure", async () => {
    mockSubmit.mockResolvedValue({ kind: "failed", submission: row({ status: "error" }), error: "boom" } as never);
    const response = await post();
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("navSubmitFailed");
  });
});
