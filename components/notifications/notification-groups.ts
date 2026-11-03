// components/notifications/notification-groups.ts
// Pure model of the notification panel (SPEC §7.3, tokens.md §6.15): which
// group a notification belongs to and how it is drawn. No React, no i18n.
import type { AppNotification, NotificationType } from "@/lib/notifications/types";

export type NotificationFilter = "all" | "unread";
export type NotificationIconKind = "triangle" | "clock" | "mail" | "bell" | "inbox" | "info";
export type NotificationTone = "crit" | "warn" | "low" | "ok" | "info";

export type NotificationVisual = { icon: NotificationIconKind; tone: NotificationTone };

const VISUALS: Record<NotificationType, NotificationVisual> = {
  overdue_invoice: { icon: "clock", tone: "warn" },
  nav_pending: { icon: "triangle", tone: "crit" },
  invoice_sent: { icon: "mail", tone: "info" },
  payment_reminder: { icon: "bell", tone: "info" },
  nav_incoming: { icon: "inbox", tone: "info" },
  system: { icon: "info", tone: "low" },
};

export function notificationVisual(type: NotificationType): NotificationVisual {
  return VISUALS[type] ?? VISUALS.system;
}

/** Teendők: things that wait for a person, whether or not they were read. */
const TODO_TYPES: NotificationType[] = ["overdue_invoice", "nav_pending"];

export function isTodoType(type: NotificationType): boolean {
  return TODO_TYPES.includes(type);
}

export type NotificationGroups = {
  /** Teendők */
  todos: AppNotification[];
  /** Korábbi */
  earlier: AppNotification[];
};

function newestFirst(a: AppNotification, b: AppNotification): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function groupNotifications(
  notifications: AppNotification[],
  filter: NotificationFilter,
): NotificationGroups {
  const visible = filter === "unread" ? notifications.filter((item) => !item.read) : notifications;
  const sorted = [...visible].sort(newestFirst);
  return {
    todos: sorted.filter((item) => isTodoType(item.type)),
    earlier: sorted.filter((item) => !isTodoType(item.type)),
  };
}
