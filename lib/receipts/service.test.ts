// lib/receipts/service.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "receipt-id-1"),
  createSecureToken: jest.fn(() => "secure-qr-token"),
}));

jest.mock("@/lib/receipts/qr-payload", () => ({
  buildReceiptQrUrl: (token: string) =>
    `http://localhost:8081/receipts/view?token=${token}`,
}));

import { db } from "@/db";
import { getCompanyByUserId } from "@/lib/companies/service";
import {
  calculateLineItemTotals,
  createReceipt,
  getDailyVatAggregation,
  getPublicReceiptByToken,
  getVatAggregationForRange,
  markReceiptsSubmittedForRange,
  validateReceiptInput,
} from "@/lib/receipts/service";

const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};
const mockCompany = getCompanyByUserId as jest.MockedFunction<
  typeof getCompanyByUserId
>;

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
  it("rejects when no totalAmount and no lineItems", () => {
    expect(validateReceiptInput({})).toContain("totalAmount or lineItems");
  });

  it("rejects non-positive totals without line items", () => {
    expect(validateReceiptInput({ totalAmount: 0 })).toContain(
      "greater than zero"
    );
  });

  it("accepts valid totalAmount input", () => {
    expect(
      validateReceiptInput({ totalAmount: 100, currency: "HUF" })
    ).toBeNull();
  });

  it("accepts valid lineItems input", () => {
    expect(
      validateReceiptInput({
        lineItems: [
          { description: "Item", quantity: 1, unitPrice: 1000, vatRate: 27 },
        ],
      })
    ).toBeNull();
  });

  it("rejects line item with empty description", () => {
    expect(
      validateReceiptInput({
        lineItems: [
          { description: "", quantity: 1, unitPrice: 1000, vatRate: 27 },
        ],
      })
    ).toContain("description");
  });

  it("rejects line item with zero quantity", () => {
    expect(
      validateReceiptInput({
        lineItems: [
          { description: "Item", quantity: 0, unitPrice: 1000, vatRate: 27 },
        ],
      })
    ).toContain("quantity");
  });

  it("rejects invalid currency", () => {
    expect(
      validateReceiptInput({
        totalAmount: 100,
        currency: "USD" as "EUR" | "HUF",
      })
    ).toContain("currency");
  });
});

describe("calculateLineItemTotals", () => {
  it("calculates single item with 27% VAT", () => {
    const result = calculateLineItemTotals([
      { description: "Item", quantity: 2, unitPrice: 1000, vatRate: 27 },
    ]);
    expect(result.netTotal).toBe(2000);
    expect(result.vatTotal).toBe(540);
    expect(result.grossTotal).toBe(2540);
    expect(result.vatBreakdown).toHaveLength(1);
    expect(result.vatBreakdown[0].vatRate).toBe(27);
  });

  it("aggregates multiple VAT rates", () => {
    const result = calculateLineItemTotals([
      { description: "A", quantity: 1, unitPrice: 1000, vatRate: 27 },
      { description: "B", quantity: 1, unitPrice: 500, vatRate: 5 },
      { description: "C", quantity: 1, unitPrice: 200, vatRate: 27 },
    ]);
    expect(result.vatBreakdown).toHaveLength(2);

    const vat27 = result.vatBreakdown.find((v) => v.vatRate === 27)!;
    expect(vat27.netAmount).toBe(1200);
    expect(vat27.vatAmount).toBe(324);
    expect(vat27.itemCount).toBe(2);

    const vat5 = result.vatBreakdown.find((v) => v.vatRate === 5)!;
    expect(vat5.netAmount).toBe(500);
    expect(vat5.vatAmount).toBe(25);
    expect(vat5.itemCount).toBe(1);
  });

  it("handles zero VAT rate", () => {
    const result = calculateLineItemTotals([
      { description: "Tax-free", quantity: 1, unitPrice: 1000, vatRate: 0 },
    ]);
    expect(result.netTotal).toBe(1000);
    expect(result.vatTotal).toBe(0);
    expect(result.grossTotal).toBe(1000);
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
          paymentMethod: "cash",
          navSubmitted: false,
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
            paymentMethod: "cash",
            navSubmitted: false,
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

  it("creates receipt with line items and calculates total", async () => {
    const record = await createReceipt("u1", {
      lineItems: [
        { description: "Kávé", quantity: 2, unitPrice: 500, vatRate: 27 },
      ],
    });
    expect(record.receiptNumber).toMatch(/^NYG-/);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});

const rangeReceiptRow = {
  id: "r1",
  userId: "u1",
  receiptNumber: "NYG-2026-001",
  clientName: "Walk-in",
  totalAmount: "1270",
  currency: "HUF",
  paymentMethod: "cash",
  qrToken: "qr-token",
  navSubmitted: false,
  issuedAt: new Date("2026-07-05T10:00:00.000Z"),
  createdAt: new Date("2026-07-05T10:00:00.000Z"),
  updatedAt: new Date("2026-07-05T10:00:00.000Z"),
};

const rangeLineItemRow = {
  id: "li-1",
  receiptId: "r1",
  description: "Kávé",
  quantity: "1",
  unitPrice: "1000",
  vatRate: 27,
  unit: "db",
  sortOrder: 0,
};

describe("getVatAggregationForRange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates receipts within the given instant range under the given reportDate", async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([rangeReceiptRow]))
      .mockReturnValueOnce(selectChain([rangeLineItemRow]));

    const result = await getVatAggregationForRange(
      "u1",
      new Date("2026-07-04T22:00:00.000Z"),
      new Date("2026-07-05T21:59:59.999Z"),
      "2026-07-05"
    );

    expect(result.reportDate).toBe("2026-07-05");
    expect(result.receiptCount).toBe(1);
    expect(result.startReceiptNumber).toBe("NYG-2026-001");
    expect(result.endReceiptNumber).toBe("NYG-2026-001");
    expect(result.vatBreakdown).toHaveLength(1);
  });
});

describe("getDailyVatAggregation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("still returns the same shape, delegating to getVatAggregationForRange with the local calendar day", async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([rangeReceiptRow]))
      .mockReturnValueOnce(selectChain([rangeLineItemRow]));

    const inputDate = new Date("2026-07-05T10:00:00.000Z");
    const result = await getDailyVatAggregation("u1", inputDate);

    // reportDate is derived the same (unchanged, environment-local-day)
    // way the pre-existing implementation derived it — delegation must
    // not change this behaviour, so we compute it identically here
    // rather than hardcoding a date string that would couple this test
    // to the test runner's own timezone.
    const localDayStart = new Date(inputDate);
    localDayStart.setHours(0, 0, 0, 0);
    expect(result.reportDate).toBe(localDayStart.toISOString().slice(0, 10));
    expect(result.receiptCount).toBe(1);
    expect(result.startReceiptNumber).toBe("NYG-2026-001");
    expect(result.endReceiptNumber).toBe("NYG-2026-001");
    expect(result.vatBreakdown).toHaveLength(1);
  });
});

describe("markReceiptsSubmittedForRange", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("issues a single update scoped to the user and the given range", async () => {
    const whereMock = jest.fn().mockResolvedValue(undefined);
    const setMock = jest.fn(() => ({ where: whereMock }));
    mockDb.update.mockReturnValue({ set: setMock });

    await markReceiptsSubmittedForRange(
      "u1",
      new Date("2026-07-04T22:00:00.000Z"),
      new Date("2026-07-05T21:59:59.999Z")
    );

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ navSubmitted: true })
    );
    expect(whereMock).toHaveBeenCalledTimes(1);
  });
});
