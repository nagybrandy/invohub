// lib/reminders/process.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/db/schema", () => ({
  invoice: { id: "invoice.id", userId: "invoice.userId" },
  paymentReminderSchedule: { userId: "paymentReminderSchedule.userId", enabled: "paymentReminderSchedule.enabled" },
}));

jest.mock("@/lib/clients/service", () => ({
  listClients: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("@/lib/email/templates/service", () => ({
  getEmailTemplateByType: jest.fn(),
}));

jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
}));

import { db } from "@/db";
import { invoice } from "@/db/schema";
import { listClients } from "@/lib/clients/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { getEmailTemplateByType } from "@/lib/email/templates/service";
import { listInvoices } from "@/lib/invoices/service";
import { processPaymentReminders } from "@/lib/reminders/process";

const mockDb = db as unknown as { select: jest.Mock; update: jest.Mock };
const mockListClients = listClients as jest.MockedFunction<typeof listClients>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockGetTemplate = getEmailTemplateByType as jest.MockedFunction<typeof getEmailTemplateByType>;
const mockListInvoices = listInvoices as jest.MockedFunction<typeof listInvoices>;

const schedule = {
  id: "sched-1",
  userId: "user-1",
  invoiceId: null,
  enabled: true,
  intervalDays: 3,
  maxReminders: 3,
  remindersSent: 0,
  lastSentAt: null,
};

const overdueInvoice = {
  id: "inv-1",
  invoiceNumber: "INV-2026-001",
  clientName: "Tech Solutions Kft.",
  clientId: "client-1",
  status: "sent",
  currency: "HUF",
  dueDate: "2020-01-01",
  lineItems: [{ id: "li-1", description: "Work", quantity: 1, unitPrice: 10000, vatRate: 27 }],
};

const template = {
  id: "tpl-1",
  subject: "Reminder for {{invoiceNumber}}",
  bodyHtml: "<p>{{clientName}}</p>",
  bodyText: "{{clientName}}",
};

function mockUpdateChain() {
  return {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

describe("processPaymentReminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([schedule]),
      }),
    });
    mockDb.update.mockImplementation(() => mockUpdateChain());
    mockListInvoices.mockResolvedValue({
      invoices: [overdueInvoice],
      total: 1,
      limit: 500,
      offset: 0,
    } as never);
    mockGetCompany.mockResolvedValue({ name: "InvoHub Demo" } as never);
    mockGetTemplate.mockResolvedValue(template as never);
    mockSendEmail.mockResolvedValue({ ok: true });
    mockListClients.mockResolvedValue([
      { id: "client-1", userId: "user-1", name: "Tech Solutions Kft.", email: "szamlazas@techsolutions.hu" },
    ] as never);
  });

  it("sends a reminder to the client's real email on file, never a placeholder", async () => {
    const result = await processPaymentReminders("user-1");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].to).toBe("szamlazas@techsolutions.hu");
    expect(result.sent).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("skips and logs invoices whose client has no email on file, without sending to a placeholder", async () => {
    mockListClients.mockResolvedValue([
      { id: "client-1", userId: "user-1", name: "Tech Solutions Kft.", email: undefined },
    ] as never);

    const result = await processPaymentReminders("user-1");

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("INV-2026-001");
    expect(result.errors[0]).not.toContain("client@example.com");
  });

  it("sets a reminded invoice's status to overdue", async () => {
    await processPaymentReminders("user-1");

    const invoiceUpdateCalls = mockDb.update.mock.calls.filter(([table]) => table === invoice);
    expect(invoiceUpdateCalls).toHaveLength(1);
  });

  it("does not downgrade an already partially_paid invoice's status when it gets a reminder", async () => {
    mockListInvoices.mockResolvedValue({
      invoices: [{ ...overdueInvoice, status: "partially_paid" }],
      total: 1,
      limit: 500,
      offset: 0,
    } as never);

    const result = await processPaymentReminders("user-1");

    expect(result.sent).toBe(1);
    // The reminder still sends and the schedule still advances, but the
    // invoice's own status update must be skipped entirely — forcing it to
    // "overdue" would discard the partial-payment signal.
    const invoiceUpdateCalls = mockDb.update.mock.calls.filter(([table]) => table === invoice);
    expect(invoiceUpdateCalls).toHaveLength(0);
  });

  it("skips invoices with no linked client record at all", async () => {
    mockListInvoices.mockResolvedValue({
      invoices: [{ ...overdueInvoice, clientId: undefined }],
      total: 1,
      limit: 500,
      offset: 0,
    } as never);

    const result = await processPaymentReminders("user-1");

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(1);
  });
});

describe("processPaymentReminders — partial failures must not sink the run", () => {
  const otherUserSchedule = { ...schedule, id: "sched-2", userId: "user-2" };
  const otherInvoice = { ...overdueInvoice, id: "inv-2", invoiceNumber: "INV-2026-002" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([schedule, otherUserSchedule]),
      }),
    });
    mockDb.update.mockImplementation(() => mockUpdateChain());
    mockGetCompany.mockResolvedValue({ name: "InvoHub Demo" } as never);
    mockGetTemplate.mockResolvedValue(template as never);
    mockSendEmail.mockResolvedValue({ ok: true });
    mockListClients.mockResolvedValue([
      { id: "client-1", userId: "user-1", name: "Tech Solutions Kft.", email: "szamlazas@techsolutions.hu" },
    ] as never);
    mockListInvoices.mockResolvedValue({ invoices: [overdueInvoice], total: 1, limit: 500, offset: 0 } as never);
  });

  it("keeps processing the other users when one user's data can't be loaded", async () => {
    mockListInvoices.mockImplementation(async (uid: string) => {
      if (uid === "user-1") throw new Error("Neon: connection reset");
      return { invoices: [otherInvoice], total: 1, limit: 500, offset: 0 } as never;
    });

    const result = await processPaymentReminders();

    // user-2 still got its reminder
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toMatch(/user-1/);
    expect(result.errors.join(" ")).toMatch(/connection reset/);
  });

  it("keeps processing the other invoices when one send throws instead of returning an error", async () => {
    mockListInvoices.mockResolvedValue({
      invoices: [overdueInvoice, otherInvoice],
      total: 2,
      limit: 500,
      offset: 0,
    } as never);
    mockSendEmail
      .mockRejectedValueOnce(new Error("SMTP socket hang up"))
      .mockResolvedValue({ ok: true });

    const result = await processPaymentReminders("user-1");

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toMatch(/INV-2026-001/);
    expect(result.errors.join(" ")).toMatch(/socket hang up/);
  });

  it("counts a send the provider refused as failed, not silently processed", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "550 mailbox unavailable" });

    const result = await processPaymentReminders("user-1");

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors.join(" ")).toMatch(/550 mailbox unavailable/);
  });

  it("flags the duplicate risk when the e-mail went out but its bookkeeping did not", async () => {
    // The mail is already in the client's inbox at this point; if the counter
    // never lands, the next run sends the same reminder again.
    mockDb.update.mockImplementation(() => ({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error("write conflict")),
      }),
    }));

    const result = await processPaymentReminders("user-1");

    expect(result.sent).toBe(1);
    expect(result.errors.join(" ")).toMatch(/INV-2026-001/);
    expect(result.errors.join(" ")).toMatch(/write conflict/);
    // named clearly enough that an operator knows a repeat may follow
    expect(result.errors.join(" ")).toMatch(/duplicate|ismétl|újraküld/i);
  });

  it("loads the e-mail template once per user, not once per invoice", async () => {
    mockListInvoices.mockResolvedValue({
      invoices: [overdueInvoice, otherInvoice],
      total: 2,
      limit: 500,
      offset: 0,
    } as never);

    await processPaymentReminders("user-1");

    expect(mockGetTemplate).toHaveBeenCalledTimes(1);
  });
});
