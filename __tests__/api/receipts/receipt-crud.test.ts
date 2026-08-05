// __tests__/api/receipts/receipt-crud.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/receipts/service", () => ({
  listReceipts: jest.fn(),
  createReceipt: jest.fn(),
  getReceiptById: jest.fn(),
  validateReceiptInput: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import {
  listReceipts,
  createReceipt,
  getReceiptById,
  validateReceiptInput,
} from "@/lib/receipts/service";
import { GET as listGET, POST } from "@/app/api/receipts+api";
import { GET as detailGET } from "@/app/api/receipts/[id]+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockList = listReceipts as jest.MockedFunction<typeof listReceipts>;
const mockCreate = createReceipt as jest.MockedFunction<typeof createReceipt>;
const mockGetById = getReceiptById as jest.MockedFunction<typeof getReceiptById>;
const mockValidate = validateReceiptInput as jest.MockedFunction<typeof validateReceiptInput>;

const fakeReceipt = {
  id: "r1",
  userId: "user-1",
  receiptNumber: "NYG-001",
  totalAmount: 5000,
  currency: "HUF" as const,
  paymentMethod: "cash",
  qrToken: "tok-1",
  qrUrl: "http://localhost/receipts/verify/tok-1",
  navSubmitted: false,
  lineItems: [],
  issuedAt: "2026-06-01T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("GET /api/receipts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await listGET(new Request("http://localhost/api/receipts"));
    expect(res.status).toBe(401);
  });

  it("returns list of receipts", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockList.mockResolvedValue([fakeReceipt as never]);

    const res = await listGET(new Request("http://localhost/api/receipts"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.receipts).toHaveLength(1);
    expect(body.receipts[0].id).toBe("r1");
    expect(mockList).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/receipts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ totalAmount: 1000 }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: "not-json",
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 on validation error", async () => {
    mockValidate.mockReturnValue("totalAmount must be a number.");

    const res = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ totalAmount: "bad" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("totalAmount must be a number.");
  });

  it("creates a receipt on success", async () => {
    mockValidate.mockReturnValue(null);
    mockCreate.mockResolvedValue(fakeReceipt as never);

    const res = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ totalAmount: 5000, currency: "HUF" }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.receipt.id).toBe("r1");
    expect(mockCreate).toHaveBeenCalledWith("user-1", {
      totalAmount: 5000,
      currency: "HUF",
    });
  });

  it("returns 400 when create throws", async () => {
    mockValidate.mockReturnValue(null);
    mockCreate.mockRejectedValue(new Error("Duplicate receipt number"));

    const res = await POST(
      new Request("http://localhost/api/receipts", {
        method: "POST",
        body: JSON.stringify({ totalAmount: 5000 }),
      })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Duplicate receipt number");
  });
});

describe("GET /api/receipts/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await detailGET(
      new Request("http://localhost/api/receipts/r1"),
      { params: { id: "r1" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const res = await detailGET(
      new Request("http://localhost/api/receipts"),
      {}
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when receipt not found", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetById.mockResolvedValue(null);

    const res = await detailGET(
      new Request("http://localhost/api/receipts/missing"),
      { params: { id: "missing" } }
    );
    expect(res.status).toBe(404);
  });

  it("returns receipt json", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetById.mockResolvedValue(fakeReceipt as never);

    const res = await detailGET(
      new Request("http://localhost/api/receipts/r1"),
      { params: { id: "r1" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.receipt.id).toBe("r1");
    expect(mockGetById).toHaveBeenCalledWith("user-1", "r1");
  });
});
