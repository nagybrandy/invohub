// lib/notifications/service.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "notif-new-id"),
}));

import { db } from "@/db";
import { invoice, navSubmission, notification } from "@/db/schema";
import {
  backfillLegacyNotificationText,
  createNotification,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  seedDemoNotifications,
  syncNotificationsFromDomain,
} from "@/lib/notifications/service";

const mockDb = db as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

/**
 * Queues one resolved result per `db.select()` call (in call order), and
 * records which table each call's `.from()` targeted -- so tests can assert
 * both the data returned to each query and the order queries ran in
 * (AC12: backfill's notification-table select must run before the
 * invoice-table select that regenerates alerts).
 */
function makeSelectQueue(results: unknown[]): unknown[] {
  let i = 0;
  const fromTargets: unknown[] = [];
  mockDb.select.mockImplementation(() => {
    const result = results[i++];
    return {
      from: jest.fn((table: unknown) => {
        fromTargets.push(table);
        return {
          where: jest.fn().mockResolvedValue(result),
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(result),
          }),
        };
      }),
    };
  });
  return fromTargets;
}

function mockInsertCapture(): Record<string, unknown>[] {
  const insertedValues: Record<string, unknown>[] = [];
  mockDb.insert.mockReturnValue({
    values: jest.fn((v: Record<string, unknown>) => {
      insertedValues.push(v);
      return Promise.resolve(undefined);
    }),
  });
  return insertedValues;
}

const sampleRow = {
  id: "notif-1",
  userId: "user-1",
  type: "system",
  title: "Hello",
  body: "World",
  href: "/settings",
  referenceKey: "welcome",
  read: false,
  createdAt: new Date("2026-07-01T12:00:00.000Z"),
  updatedAt: new Date("2026-07-01T12:00:00.000Z"),
};

describe("createNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([sampleRow]),
      }),
    });
  });

  it("inserts and maps a notification", async () => {
    const result = await createNotification("user-1", {
      type: "system",
      title: "Hello",
      body: "World",
      href: "/settings",
      referenceKey: "welcome",
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(result.id).toBe("notif-1");
    expect(result.body).toBe("World");
    expect(result.createdAt).toBe("2026-07-01T12:00:00.000Z");
  });
});

describe("getUnreadCount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns count of unread rows", async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]),
      }),
    });

    const count = await getUnreadCount("user-1");
    expect(count).toBe(2);
  });
});

describe("markNotificationRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ ...sampleRow, read: true }]),
        }),
      }),
    });
  });

  it("updates read flag and returns notification", async () => {
    const result = await markNotificationRead("user-1", "notif-1");
    expect(mockDb.update).toHaveBeenCalled();
    expect(result?.read).toBe(true);
  });

  it("returns null when not found", async () => {
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([]),
        }),
      }),
    });
    const result = await markNotificationRead("user-1", "missing");
    expect(result).toBeNull();
  });
});

describe("markAllNotificationsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns row count from update", async () => {
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 3 }),
      }),
    });

    const count = await markAllNotificationsRead("user-1");
    expect(count).toBe(3);
  });
});

describe("syncNotificationsFromDomain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores encoded notifications.content.* keys (not English prose) for overdue/sent/nav_pending, carrying number/clientName params, with referenceKeys unchanged (AC2, AC3)", async () => {
    makeSelectQueue([
      [], // backfill: no existing rows for this user
      [
        {
          id: "inv-1",
          invoiceNumber: "2026/007",
          clientName: "Kovács Bt.",
          status: "overdue",
          userId: "user-1",
        },
        {
          id: "inv-2",
          invoiceNumber: "2026/010",
          clientName: "Tóth Kft.",
          status: "sent",
          userId: "user-1",
        },
      ],
      [], // upsertByReference(overdue): no existing row
      [], // upsertByReference(sent): no existing row
      [{ submission: { id: "sub-1", invoiceId: "inv-3" }, invoiceNumber: "2026/099" }],
      [], // upsertByReference(nav): no existing row
    ]);
    const insertedValues = mockInsertCapture();

    await syncNotificationsFromDomain("user-1");

    expect(insertedValues).toHaveLength(3);
    const overdueIns = insertedValues.find((v) => v.referenceKey === "overdue:inv-1")!;
    const sentIns = insertedValues.find((v) => v.referenceKey === "sent:inv-2")!;
    const navIns = insertedValues.find((v) => v.referenceKey === "nav-pending:sub-1")!;

    expect(overdueIns.title).toBe('notifications.content.overdueInvoiceTitle {"number":"2026/007"}');
    expect(overdueIns.body).toBe('notifications.content.overdueInvoiceBody {"clientName":"Kovács Bt."}');
    expect(overdueIns.title).not.toContain("Overdue: ");
    expect(overdueIns.body).not.toContain("payment past due");

    expect(sentIns.title).toBe('notifications.content.invoiceSentTitle {"number":"2026/010"}');
    expect(sentIns.body).toBe('notifications.content.invoiceSentBody {"clientName":"Tóth Kft."}');
    expect(sentIns.title).not.toContain("Awaiting payment: ");
    expect(sentIns.body).not.toContain("Sent to ");

    expect(navIns.title).toBe("notifications.content.navPendingTitle");
    expect(navIns.body).toBe('notifications.content.navPendingBody {"number":"2026/099"}');
    expect(navIns.title).not.toContain("NAV submission pending");
    expect(navIns.body).not.toContain("waiting for NAV confirmation");
  });

  it("calls the backfill (a notification-table select) before regenerating alerts (AC12)", async () => {
    const fromTargets = makeSelectQueue([[], [], []]);
    mockInsertCapture();

    await syncNotificationsFromDomain("user-1");

    expect(fromTargets[0]).toBe(notification);
    expect(fromTargets[1]).toBe(invoice);
    expect(fromTargets[2]).toBe(navSubmission);
  });
});

describe("seedDemoNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores encoded keys for its three rows, reusing overdueInvoiceTitle/Body with literal demo params (AC2)", async () => {
    makeSelectQueue([[], [], []]);
    const insertedValues = mockInsertCapture();

    await seedDemoNotifications("user-1");

    expect(insertedValues).toHaveLength(3);
    const welcome = insertedValues.find((v) => v.referenceKey === "welcome")!;
    const overdue = insertedValues.find((v) => v.referenceKey === "demo-overdue-1")!;
    const reminder = insertedValues.find((v) => v.referenceKey === "demo-reminder-1")!;

    expect(welcome.title).toBe("notifications.content.welcomeTitle");
    expect(welcome.body).toBe("notifications.content.welcomeBody");
    expect(welcome.title).not.toContain("Welcome to InvoHub");

    expect(overdue.title).toBe('notifications.content.overdueInvoiceTitle {"number":"INV-2026-003"}');
    expect(overdue.body).toBe(
      'notifications.content.overdueInvoiceBody {"clientName":"Budapest Bistro Kft."}'
    );

    expect(reminder.title).toBe("notifications.content.reminderScheduledTitle");
    expect(reminder.body).toBe("notifications.content.reminderScheduledBody");
  });
});

describe("backfillLegacyNotificationText", () => {
  const legacyRow = {
    id: "n-legacy",
    userId: "user-1",
    type: "overdue_invoice",
    title: "Overdue: 2026/007",
    body: "Kovács Bt. — payment past due date.",
    href: "/invoices/inv-1",
    referenceKey: "overdue:inv-1",
    read: false,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
  const encodedRow = {
    id: "n-encoded",
    userId: "user-1",
    type: "nav_pending",
    title: "notifications.content.navPendingTitle",
    body: 'notifications.content.navPendingBody {"number":"2026/099"}',
    href: "/invoices/inv-3",
    referenceKey: "nav-pending:sub-1",
    read: false,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };
  const hungarianRow = {
    id: "n-user-authored",
    userId: "user-1",
    type: "system",
    title: "Hívd fel az ügyfelet holnap",
    body: null,
    href: null,
    referenceKey: null,
    read: false,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("issues an UPDATE only for rows the normalizer actually changed, touching only title/body/updatedAt (AC10)", async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([legacyRow, encodedRow, hungarianRow]),
      }),
    });
    const setCalls: Record<string, unknown>[] = [];
    mockDb.update.mockReturnValue({
      set: jest.fn((v: Record<string, unknown>) => {
        setCalls.push(v);
        return { where: jest.fn().mockResolvedValue(undefined) };
      }),
    });

    const updatedCount = await backfillLegacyNotificationText("user-1");

    expect(updatedCount).toBe(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(setCalls[0]).sort()).toEqual(["body", "title", "updatedAt"]);
    expect(setCalls[0].title).toBe('notifications.content.overdueInvoiceTitle {"number":"2026/007"}');
    expect(setCalls[0].body).toBe('notifications.content.overdueInvoiceBody {"clientName":"Kovács Bt."}');
  });

  it("scopes the select by userId and never touches read/createdAt/href/type/referenceKey", async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([legacyRow]),
      }),
    });
    const setCalls: Record<string, unknown>[] = [];
    mockDb.update.mockReturnValue({
      set: jest.fn((v: Record<string, unknown>) => {
        setCalls.push(v);
        return { where: jest.fn().mockResolvedValue(undefined) };
      }),
    });

    await backfillLegacyNotificationText("user-1");

    expect(mockDb.select).toHaveBeenCalled();
    for (const forbidden of ["read", "createdAt", "href", "type", "referenceKey"]) {
      expect(setCalls[0]).not.toHaveProperty(forbidden);
    }
  });

  it("running it twice over the same (already-encoded) data updates 0 rows the second time (AC11)", async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([encodedRow, hungarianRow]),
      }),
    });

    const first = await backfillLegacyNotificationText("user-1");
    const second = await backfillLegacyNotificationText("user-1");

    expect(first).toBe(0);
    expect(second).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
