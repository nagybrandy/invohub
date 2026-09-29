// __tests__/api/nav/status.test.ts
// POST /api/nav/status polls NAV (mocked client — demo/test only) for the
// latest submission NAV actually received.
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

const mockWhere = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn(() => ({ where: mockWhere }));
jest.mock("@/db", () => ({ db: { update: jest.fn(() => ({ set: mockSet })) } }));

jest.mock("@/lib/invoices/service", () => ({ getInvoiceById: jest.fn() }));
jest.mock("@/lib/companies/service", () => ({ getCompanyByUserId: jest.fn().mockResolvedValue(null) }));
const mockList = jest.fn();
jest.mock("@/lib/nav/list-submissions", () => ({
  listNavSubmissionsForInvoice: (...args: unknown[]) => mockList(...args),
}));
const mockQuery = jest.fn();
jest.mock("@/lib/nav/client", () => ({
  getNavClient: jest.fn(() => ({ queryTransactionStatus: mockQuery })),
}));
jest.mock("@/lib/nav/resolve-credentials", () => ({ resolveNavCredentials: jest.fn() }));

import { POST } from "@/app/api/nav/status+api";
import { requireSession } from "@/lib/api/session";
import { getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

function req() {
  return new Request("http://localhost/api/nav/status", {
    method: "POST",
    body: JSON.stringify({ invoiceId: "inv-1" }),
  });
}

describe("POST /api/nav/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
    (getInvoiceById as jest.Mock).mockResolvedValue(makeInvoice({ id: "inv-1" }));
  });

  it("skips a newer failed attempt without a transactionId and polls the one NAV received", async () => {
    mockList.mockResolvedValue([
      { id: "new", status: "error", mode: "demo", transactionId: null },
      { id: "old", status: "sent", mode: "demo", transactionId: "TX-OLD" },
    ]);
    mockQuery.mockResolvedValue({ transactionId: "TX-OLD", status: "DONE", messages: [] });

    const res = await POST(req());

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(null, "TX-OLD");
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "done" }));
  });

  it("returns 404 when nothing was ever received by NAV", async () => {
    mockList.mockResolvedValue([{ id: "x", status: "error", mode: "demo", transactionId: null }]);
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
