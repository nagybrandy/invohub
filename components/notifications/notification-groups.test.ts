// components/notifications/notification-groups.test.ts
import {
  groupNotifications,
  isTodoType,
  notificationVisual,
} from "@/components/notifications/notification-groups";
import { NOTIFICATION_TYPES, type AppNotification } from "@/lib/notifications/types";

function n(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: "n",
    userId: "u",
    type: "system",
    title: "t",
    read: false,
    createdAt: "2026-11-03T08:00:00.000Z",
    updatedAt: "2026-11-03T08:00:00.000Z",
    ...overrides,
  };
}

describe("notificationVisual", () => {
  it("maps each type to an icon and tone (SPEC §7.3)", () => {
    expect(notificationVisual("overdue_invoice")).toEqual({ icon: "clock", tone: "warn" });
    expect(notificationVisual("nav_pending")).toEqual({ icon: "triangle", tone: "crit" });
    expect(notificationVisual("invoice_sent")).toEqual({ icon: "mail", tone: "info" });
    expect(notificationVisual("payment_reminder")).toEqual({ icon: "bell", tone: "info" });
    expect(notificationVisual("nav_incoming")).toEqual({ icon: "inbox", tone: "info" });
    expect(notificationVisual("system")).toEqual({ icon: "info", tone: "low" });
  });

  it("covers every notification type", () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationVisual(type)).toBeDefined();
    }
  });
});

describe("isTodoType", () => {
  it("only overdue_invoice and nav_pending are to-dos", () => {
    expect(NOTIFICATION_TYPES.filter(isTodoType)).toEqual(["overdue_invoice", "nav_pending"]);
  });
});

describe("groupNotifications", () => {
  const items = [
    n({ id: "a", type: "overdue_invoice", read: true, createdAt: "2026-11-03T07:00:00.000Z" }),
    n({ id: "b", type: "invoice_sent", read: false, createdAt: "2026-11-02T07:00:00.000Z" }),
    n({ id: "c", type: "nav_pending", read: false, createdAt: "2026-11-03T09:00:00.000Z" }),
    n({ id: "d", type: "system", read: true, createdAt: "2026-10-01T07:00:00.000Z" }),
  ];

  it("splits to-dos from earlier items and keeps read to-dos listed", () => {
    const groups = groupNotifications(items, "all");
    expect(groups.todos.map((x) => x.id)).toEqual(["c", "a"]);
    expect(groups.earlier.map((x) => x.id)).toEqual(["b", "d"]);
  });

  it("the unread tab keeps unread items only", () => {
    const groups = groupNotifications(items, "unread");
    expect(groups.todos.map((x) => x.id)).toEqual(["c"]);
    expect(groups.earlier.map((x) => x.id)).toEqual(["b"]);
  });

  it("returns empty groups for an empty list", () => {
    expect(groupNotifications([], "all")).toEqual({ todos: [], earlier: [] });
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    groupNotifications(items, "all");
    expect(items).toEqual(copy);
  });
});
