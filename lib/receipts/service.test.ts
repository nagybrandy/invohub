// lib/receipts/service.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "receipt-id-1"),
}));

jest.mock("@/lib/receipts/qr-payload", () => ({
  buildReceiptQrUrl: (token: string) => `http://localhost:8081/receipts/view?token=${token}`,
}));

import { db } from "@/db";
import { getCompanyByUserId } from "@/lib/companies/service";
import {
  createReceipt,
  getPublicReceiptByToken,
  validateReceiptInput,
} from "@/lib/receipts/service";

const mockDb = db as unknown as { select: jest.Mock; insert: jest.Mock };
const mockCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;

function makeWhereResult(rows: unknown[]) {
  return {
    orderBy: jest.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  };
}

function selectChain(rows: unknown[]) {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => makeWhereResult(rows)),
    })),
  };
}

describe("validateReceiptInput", () => {
  it("rejects non-positive totals", () => {
    expect(validateReceiptInput({ totalAmount: 0 })).toContain("greater than zero");
  });

  it("accepts valid input", () => {
    expect(validateReceiptInput({ totalAmount: 100, currency: "HUF" })).toBeNull();
  });
});

describe("getPublicReceiptByToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany.mockResolvedValue({
      id: "c1",
      userId: "u1",
      name: "Demo Kft.",
      createdAt: "",
      updatedAt: "",
    });
  });

  it("returns null for empty token", async () => {
    expect(await getPublicReceiptByToken("")).toBeNull();
  });

  it("maps public receipt view", async () => {
    mockDb.select.mockReturnValue(
      selectChain([
        {
          id: "r1",
          userId: "u1",
          receiptNumber: "NYG-2026-001",
          clientName: "Walk-in",
          totalAmount: "12500",
          currency: "HUF",
          qrToken: "qr-token",
          issuedAt: new Date("2026-07-04T10:00:00.000Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );

    const view = await getPublicReceiptByToken("qr-token");
    expect(view?.receiptNumber).toBe("NYG-2026-001");
    expect(view?.issuerName).toBe("Demo Kft.");
    expect(view?.verified).toBe(true);
  });
});

describe("createReceipt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReturnValue(selectChain([]));
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([
          {
            id: "receipt-id-1",
            userId: "u1",
            receiptNumber: "NYG-2026-001",
            clientName: "Walk-in",
            totalAmount: "5000",
            currency: "HUF",
            qrToken: "receipt-id-1",
            issuedAt: new Date("2026-07-04T10:00:00.000Z"),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      })),
    });
  });

  it("creates receipt with generated number", async () => {
    const record = await createReceipt("u1", { totalAmount: 5000 });
    expect(record.receiptNumber).toMatch(/^NYG-/);
    expect(record.qrUrl).toContain("/receipts/view?token=");
  });
});
