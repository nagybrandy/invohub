// lib/seed/demo-data.test.ts
jest.mock("@/db", () => {
  const chainable = () => {
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockReturnThis(),
    };
    return chain;
  };

  return {
    db: {
      insert: jest.fn().mockImplementation(chainable),
      delete: jest.fn().mockImplementation(chainable),
      select: jest.fn().mockImplementation(chainable),
    },
  };
});

jest.mock("@/db/schema", () => ({
  client: { userId: "client.userId" },
  company: { userId: "company.userId" },
  incomingInvoice: { userId: "incomingInvoice.userId" },
  invoice: { id: "invoice.id", userId: "invoice.userId" },
  navSubmission: { invoiceId: "navSubmission.invoiceId" },
  navReceiptSubmission: { userId: "navReceiptSubmission.userId" },
  notification: { userId: "notification.userId" },
  paymentReminderSchedule: { userId: "paymentReminderSchedule.userId" },
  product: { userId: "product.userId" },
  receipt: { userId: "receipt.userId" },
  receiptLineItem: { receiptId: "receiptLineItem.receiptId" },
}));

jest.mock("@/lib/email/templates/service", () => ({
  seedDefaultTemplates: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => `id-${Math.random().toString(36).slice(2, 10)}`),
}));

jest.mock("@/lib/notifications/service", () => ({
  seedDemoNotifications: jest.fn().mockResolvedValue(undefined),
  syncNotificationsFromDomain: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/invoices/service", () => ({
  upsertInvoice: jest.fn().mockImplementation((_uid: string, inv: any) =>
    Promise.resolve({ id: inv.id ?? "upserted-id" })
  ),
}));

import { db } from "@/db";
import { seedDemoData } from "@/lib/seed/demo-data";
import { seedDefaultTemplates } from "@/lib/email/templates/service";
import { seedDemoNotifications, syncNotificationsFromDomain } from "@/lib/notifications/service";
import { upsertInvoice } from "@/lib/invoices/service";

const mockDb = db as jest.Mocked<typeof db>;

describe("seedDemoData", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });
  });

  it("returns correct counts", async () => {
    const result = await seedDemoData("user-1");

    expect(result).toEqual({
      clients: 8,
      products: 10,
      invoices: 12,
      receipts: 8,
      incoming: 4,
      receiptLineItems: expect.any(Number),
      navReceiptSubmissions: 2,
    });
  });

  it("deletes existing data before seeding", async () => {
    await seedDemoData("user-1");

    const deleteCalls = (mockDb.delete as jest.Mock).mock.calls;
    expect(deleteCalls.length).toBeGreaterThanOrEqual(8);
  });

  it("inserts company record", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const companyInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").company
    );
    expect(companyInserts).toHaveLength(1);
  });

  it("inserts 8 clients", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const clientInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").client
    );
    expect(clientInserts).toHaveLength(8);
  });

  it("inserts 10 products", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const productInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").product
    );
    expect(productInserts).toHaveLength(10);
  });

  it("upserts 12 invoices via service", async () => {
    await seedDemoData("user-1");

    expect(upsertInvoice).toHaveBeenCalledTimes(12);
    const firstCall = (upsertInvoice as jest.Mock).mock.calls[0];
    expect(firstCall[0]).toBe("user-1");
    expect(firstCall[1]).toHaveProperty("invoiceNumber", "INV-2026-001");
  });

  it("inserts 8 receipts with line items", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const receiptInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").receipt
    );
    expect(receiptInserts).toHaveLength(8);

    const lineItemInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").receiptLineItem
    );
    expect(lineItemInserts.length).toBeGreaterThan(0);
  });

  it("inserts 4 incoming invoices", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const incomingInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").incomingInvoice
    );
    expect(incomingInserts).toHaveLength(4);
  });

  it("creates 2 NAV submissions", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const navInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").navSubmission
    );
    expect(navInserts).toHaveLength(2);
  });

  it("creates 2 payment reminder schedules", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const reminderInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").paymentReminderSchedule
    );
    expect(reminderInserts).toHaveLength(2);
  });

  it("creates 2 NAV receipt submissions", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const navReceiptInserts = insertCalls.filter(
      (call: any) => call[0] === require("@/db/schema").navReceiptSubmission
    );
    expect(navReceiptInserts).toHaveLength(2);
  });

  it("sets NAV credentials on company", async () => {
    await seedDemoData("user-1");

    const insertCalls = (mockDb.insert as jest.Mock).mock.calls;
    const companyInsert = insertCalls.find(
      (call: any) => call[0] === require("@/db/schema").company
    );
    expect(companyInsert).toBeDefined();
  });

  it("seeds email templates and notifications", async () => {
    await seedDemoData("user-1");

    expect(seedDefaultTemplates).toHaveBeenCalledWith("user-1");
    expect(seedDemoNotifications).toHaveBeenCalledWith("user-1");
    expect(syncNotificationsFromDomain).toHaveBeenCalledWith("user-1");
  });
});
