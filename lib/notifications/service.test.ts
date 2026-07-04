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
import {
  createNotification,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";

const mockDb = db as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

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
