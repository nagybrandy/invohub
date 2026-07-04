// lib/notifications/service.ts
// Notification CRUD and domain-driven sync for in-app alerts.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoice, navSubmission, notification } from "@/db/schema";
import { createId } from "@/lib/id";
import type { AppNotification, NotificationInput } from "@/lib/notifications/types";

function mapRow(row: typeof notification.$inferSelect): AppNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as AppNotification["type"],
    title: row.title,
    body: row.body ?? undefined,
    href: row.href ?? undefined,
    referenceKey: row.referenceKey ?? undefined,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt));
  return rows.map(mapRow);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));
  return rows.length;
}

async function upsertByReference(
  userId: string,
  input: NotificationInput
): Promise<void> {
  if (!input.referenceKey) {
    await createNotification(userId, input);
    return;
  }

  const [existing] = await db
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.referenceKey, input.referenceKey)
      )
    );

  const now = new Date();
  if (existing) {
    await db
      .update(notification)
      .set({
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        type: input.type,
        updatedAt: now,
      })
      .where(eq(notification.id, existing.id));
    return;
  }

  await db.insert(notification).values({
    id: createId(),
    userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    referenceKey: input.referenceKey,
    read: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function createNotification(
  userId: string,
  input: NotificationInput
): Promise<AppNotification> {
  const now = new Date();
  const id = createId();
  const [row] = await db
    .insert(notification)
    .values({
      id,
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      referenceKey: input.referenceKey ?? null,
      read: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function markNotificationRead(
  userId: string,
  id: string
): Promise<AppNotification | null> {
  const now = new Date();
  const [row] = await db
    .update(notification)
    .set({ read: true, updatedAt: now })
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning();
  return row ? mapRow(row) : null;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const now = new Date();
  const result = await db
    .update(notification)
    .set({ read: true, updatedAt: now })
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));
  return result.rowCount ?? 0;
}

/** Regenerate alerts from invoices, NAV, and reminders. */
export async function syncNotificationsFromDomain(userId: string): Promise<void> {
  const invoices = await db
    .select()
    .from(invoice)
    .where(eq(invoice.userId, userId));

  for (const inv of invoices) {
    if (inv.status === "overdue") {
      await upsertByReference(userId, {
        type: "overdue_invoice",
        title: `Overdue: ${inv.invoiceNumber}`,
        body: `${inv.clientName} — payment past due date.`,
        href: `/invoices/${inv.id}`,
        referenceKey: `overdue:${inv.id}`,
      });
    }
    if (inv.status === "sent") {
      await upsertByReference(userId, {
        type: "invoice_sent",
        title: `Awaiting payment: ${inv.invoiceNumber}`,
        body: `Sent to ${inv.clientName}.`,
        href: `/invoices/${inv.id}`,
        referenceKey: `sent:${inv.id}`,
      });
    }
  }

  const pendingNav = await db
    .select({
      submission: navSubmission,
      invoiceNumber: invoice.invoiceNumber,
    })
    .from(navSubmission)
    .innerJoin(invoice, eq(navSubmission.invoiceId, invoice.id))
    .where(and(eq(invoice.userId, userId), eq(navSubmission.status, "pending")));

  for (const row of pendingNav) {
    await upsertByReference(userId, {
      type: "nav_pending",
      title: `NAV submission pending`,
      body: `${row.invoiceNumber} is waiting for NAV confirmation.`,
      href: `/invoices/${row.submission.invoiceId}`,
      referenceKey: `nav-pending:${row.submission.id}`,
    });
  }
}

export async function seedDemoNotifications(userId: string): Promise<void> {
  const demos: NotificationInput[] = [
    {
      type: "system",
      title: "Welcome to InvoHub",
      body: "Load demo data from Settings to explore all features.",
      href: "/settings",
      referenceKey: "welcome",
    },
    {
      type: "overdue_invoice",
      title: "Overdue: INV-2026-003",
      body: "Budapest Bistro Kft. — payment past due.",
      href: "/invoices",
      referenceKey: "demo-overdue-1",
    },
    {
      type: "payment_reminder",
      title: "Payment reminder scheduled",
      body: "Automatic reminder will be sent in 7 days.",
      href: "/settings/reminders",
      referenceKey: "demo-reminder-1",
    },
  ];

  for (const item of demos) {
    await upsertByReference(userId, item);
  }
}
