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
import { db } from "@/db";
import { encryptNavSecret } from "@/lib/nav/credentials";

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
  // Real submitDailyReceiptReport is only called outside demo mode — tests
  // below that exercise the real-call path opt into "test" explicitly.
  navEnvironment: "test",
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

  it("returns 400 when company profile is missing", async () => {
    mockGetCompany.mockResolvedValue(null);
    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Company profile");
  });

  it("simulates acceptance in demo mode (the default) without calling the real NAV endpoint", async () => {
    mockGetCompany.mockResolvedValue({
      ...fakeCompany,
      navEnvironment: "demo",
      navTechnicalUser: null,
      navTechnicalPassword: null,
      navXmlSignKey: null,
    } as never);

    const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transactionId).toMatch(/^RECEIPT-DEMO-/);
    expect(mockSubmit).not.toHaveBeenCalled();
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

  describe("credential handling", () => {
    const saved: Record<string, string | undefined> = {};
    const KEYS = ["NAV_CREDENTIALS_KEY", "NAV_CREDENTIALS_KEY_ID", "NAV_CREDENTIALS_PREVIOUS_KEYS", "NAV_PRODUCTION_ENABLED"];
    beforeEach(() => {
      for (const k of KEYS) {
        saved[k] = process.env[k];
        delete process.env[k];
      }
      process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 4).toString("base64");
    });
    afterEach(() => {
      for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });

    it("decrypts the sealed password/sign key only for the NAV call", async () => {
      mockGetCompany.mockResolvedValue({
        ...fakeCompany,
        navTechnicalPassword: encryptNavSecret("real-pass"),
        navXmlSignKey: encryptNavSecret("real-sign"),
      } as never);
      mockSubmit.mockResolvedValue({ ok: true, transactionId: "TX" } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ technicalPassword: "real-pass", signingKey: "real-sign" }),
        "test"
      );
      expect(JSON.stringify(body)).not.toContain("real-pass");
      expect(JSON.stringify(body)).not.toContain("real-sign");
    });

    it("returns 400 (no NAV call, no pending row) when the stored secret can't be decrypted", async () => {
      const sealed = encryptNavSecret("real-pass");
      process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 8).toString("base64");
      mockGetCompany.mockResolvedValue({
        ...fakeCompany,
        navTechnicalPassword: sealed,
        navXmlSignKey: sealed,
      } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(JSON.stringify(body)).not.toContain(sealed);
      expect(mockSubmit).not.toHaveBeenCalled();
      expect((db as unknown as { insert: jest.Mock }).insert).not.toHaveBeenCalled();
    });

    it("refuses a stored production mode when NAV_PRODUCTION_ENABLED is off", async () => {
      mockGetCompany.mockResolvedValue({ ...fakeCompany, navEnvironment: "production" } as never);

      const res = await POST(makeRequest("r1"), { params: { id: "r1" } });

      expect(res.status).toBe(400);
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });
});
