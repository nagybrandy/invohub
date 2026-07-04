// lib/nav/incoming-sync.test.ts
import { syncIncomingInvoices } from "@/lib/nav/incoming-sync";

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn().mockResolvedValue({
    navTechnicalUser: "tech-user",
    navXmlSignKey: "sign-key",
    taxNumber: "12345678-1-23",
  }),
}));

jest.mock("@/lib/nav/client", () => ({
  fetchIncomingInvoices: jest.fn().mockResolvedValue([
    {
      navInvoiceId: "NAV-TEST-1",
      supplierName: "Supplier Kft.",
      supplierTaxNumber: "11111111-1-11",
      invoiceNumber: "SUP-1",
      issueDate: "2026-06-01",
      dueDate: "2026-07-01",
      totalAmount: 1000,
      currency: "HUF",
    },
  ]),
}));

const { db } = jest.requireMock("@/db");

describe("syncIncomingInvoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.insert.mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
  });

  it("inserts new incoming invoices and returns synced count", async () => {
    const allRows = [
      {
        id: "inc-1",
        userId: "user-1",
        navInvoiceId: "NAV-TEST-1",
        supplierName: "Supplier Kft.",
        supplierTaxNumber: "11111111-1-11",
        invoiceNumber: "SUP-1",
        issueDate: "2026-06-01",
        dueDate: "2026-07-01",
        totalAmount: "1000",
        currency: "HUF",
        status: "received",
      },
    ];

    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(allRows),
        }),
      });

    const result = await syncIncomingInvoices("user-1");
    expect(result.synced).toBe(1);
    expect(result.invoices).toHaveLength(1);
    expect(db.insert).toHaveBeenCalled();
  });

  it("skips existing navInvoiceId rows", async () => {
    db.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: "existing" }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

    const result = await syncIncomingInvoices("user-1");
    expect(result.synced).toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
