// lib/notifications/types.ts
// In-app notification domain types.
export const NOTIFICATION_TYPES = [
  "overdue_invoice",
  "invoice_sent",
  "nav_pending",
  "nav_incoming",
  "payment_reminder",
  "system",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  referenceKey?: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationInput = {
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  referenceKey?: string;
};
