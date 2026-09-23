// lib/account/export.test.ts
const mockSelect = jest.fn();
jest.mock("@/db", () => ({ db: { select: (...a: unknown[]) => mockSelect(...a) } }));
jest.mock("@/lib/invoices/service", () => ({ listInvoicesInDateRange: jest.fn() }));

import { exportRetainedRecords } from "@/lib/account/export";
import { listInvoicesInDateRange } from "@/lib/invoices/service";

const mockList = listInvoicesInDateRange as jest.MockedFunction<typeof listInvoicesInDateRange>;

function selectReturning(rows: unknown[]) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn(() => chain);
  chain.where = jest.fn(() => Object.assign(Promise.resolve(rows), chain));
  chain.limit = jest.fn(() => Promise.resolve(rows));
  return chain;
}

const closedAt = new Date("2026-09-22T10:00:00Z");
const retentionUntil = new Date("2034-12-31T23:59:59.999Z");

describe("exportRetainedRecords", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null for an unknown user", async () => {
    mockSelect.mockReturnValueOnce(selectReturning([]));
    await expect(exportRetainedRecords("nope")).resolves.toBeNull();
  });

  it("exports issued invoices only (no drafts) plus NAV submissions, receipts and seller data", async () => {
    mockSelect
      .mockReturnValueOnce(selectReturning([{ id: "u1", closedAt, retentionUntil }])) // user
      .mockReturnValueOnce(selectReturning([{ id: "c1", name: "EV Kft." }])) // company
      .mockReturnValueOnce(selectReturning([{ id: "r1", receiptNumber: "NY-1" }])) // receipts
      .mockReturnValueOnce(selectReturning([{ id: "nrs1" }])) // nav receipt submissions
      .mockReturnValueOnce(selectReturning([{ id: "ns1", invoiceId: "i1" }])) // nav submissions
      .mockReturnValueOnce(selectReturning([{ id: "rli1", receiptId: "r1" }])); // receipt items
    mockList.mockResolvedValue([
      { id: "i1", status: "sent", lineItems: [] },
      { id: "i2", status: "draft", lineItems: [] },
    ] as never);

    const result = await exportRetainedRecords("u1", closedAt);

    expect(mockList).toHaveBeenCalledWith("u1", "0000-01-01", "9999-12-31");
    expect(result).toMatchObject({
      exportedAt: closedAt.toISOString(),
      user: { id: "u1", closedAt: closedAt.toISOString(), retentionUntil: retentionUntil.toISOString() },
      companies: [{ id: "c1", name: "EV Kft." }],
      navSubmissions: [{ id: "ns1", invoiceId: "i1" }],
      receipts: [{ id: "r1", lineItems: [{ id: "rli1", receiptId: "r1" }] }],
      navReceiptSubmissions: [{ id: "nrs1" }],
    });
    expect(result!.invoices.map((i) => i.id)).toEqual(["i1"]);
  });

  it("never selects NAV credential columns for the company", async () => {
    mockSelect.mockReturnValueOnce(selectReturning([{ id: "u1", closedAt: null, retentionUntil: null }]));
    mockSelect.mockReturnValue(selectReturning([]));
    mockList.mockResolvedValue([]);
    await exportRetainedRecords("u1");
    const companyColumns = mockSelect.mock.calls[1][0] as Record<string, unknown>;
    for (const key of ["navTechnicalUser", "navTechnicalPassword", "navXmlSignKey", "navXmlChangeKey"]) {
      expect(companyColumns).not.toHaveProperty(key);
    }
  });
});
