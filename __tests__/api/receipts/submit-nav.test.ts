// __tests__/api/receipts/submit-nav.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/db", () => {
  const chainable = () => {
    const chain: any = {
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
      returning: jest.fn().mockResolvedValue([]),
    };
    return chain;
  };
  return {
    db: {
      insert: jest.fn().mockImplementation(chainable),
      update: jest.fn().mockImplementation(chainable),
    },
  };
});

jest.mock("@/db/schema", () => ({
  navReceiptSubmission: { id: "navReceiptSubmission.id" },
  receipt: { id: "receipt.id" },
}));

jest.mock("@/lib/receipts/service", () => ({
  getReceiptById: jest.fn(),
  getDailyVatAggregation: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "test-id"),
}));

jest.mock("@/lib/nav-receipt/report", () => ({
  submitDailyReceiptReport: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { getReceiptById, getDailyVatAggregation } from "@/lib/receipts/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import { submitDailyReceiptReport } from "@/lib/nav-receipt/report";
import { POST } from "@/app/api/receipts/[id]/submit-nav+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetReceipt = getReceiptById as jest.MockedFunction<typeof getReceiptById>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockSubmit = submitDailyReceiptReport as jest.MockedFunction<typeof submitDailyReceiptReport>;
const mockAggregation = getDailyVatAggregation as jest.MockedFunction<typeof getDailyVatAggregation>;

function makeRequest(id: string) {
  return new Request(`http://localhost/api/receipts/${id}/submit-nav`, {
    method: "POST",
  });
}

const fakeCompany = {
  id: "comp-1",
  userId: "user-1",
  name: "Demo Kft.",
  taxNumber: "12345678-2-41",
  navTechnicalUser: "tech-user",
  navTechnicalPassword: "tech-pass",
  navXmlSignKey: "sign-key",
};

const fakeReceipt = {
  id: "r1",
  receiptNumber: "NYG-001",
  totalAmount: 5000,
  currency: "HUF",
  navSubmitted: false,
  issuedAt: "2026-06-15T10:00:00.000Z",
};

const fakeAggregation = {
  reportDate: "2026-06-15",
  receiptCount: 3,
  startReceiptNumber: "NYG-001",
  endReceiptNumber: "NYG-003",
  vatBreakdown: [
    { vatRate: 27, netAmount: 3937, vatAmount: 1063, grossAmount: 5000, itemCount: 3 },
  ],
};

describe("POST /api/receipts/[id]/submit-nav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetReceipt.mockResolvedValue(fakeReceipt as never);
    mockGetCompany.mockResolvedValue(fakeCompany as never);
    mockAggregation.mockResolvedValue(fakeAggregation as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/receipts//submit-nav", { method: "POST" }),
      {}
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when receipt not found", async () => {
    mockGetReceipt.mockResolvedValue(null);
    const res = await POST(makeRequest("missing"), { params: { id: "missing" } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when already submitted", async () => {
    mockGetReceipt.mockResolvedValue({ ...fakeReceipt, navSubmitted: true } as never);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Already submitted");
  });

  it("returns 400 when NAV credentials missing", async () => {
    mockGetCompany.mockResolvedValue({
      ...fakeCompany,
      navTechnicalUser: null,
      navTechnicalPassword: null,
      navXmlSignKey: null,
    } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("NAV credentials");
  });

  it("returns success on NAV submission", async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      transactionId: "NAV-TX-001",
    } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transactionId).toBe("NAV-TX-001");
    expect(body.receiptCount).toBe(3);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it("returns error when NAV submission fails", async () => {
    mockSubmit.mockResolvedValue({
      ok: false,
      error: "NAV validation error",
    } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NAV validation error");
  });

  it("returns 500 on unexpected exception", async () => {
    mockGetReceipt.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("DB connection lost");
  });
});
