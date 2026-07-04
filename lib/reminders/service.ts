// lib/reminders/service.ts
// Payment reminder schedule CRUD.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { paymentReminderSchedule } from "@/db/schema";
import { createId } from "@/lib/id";

export type ReminderScheduleInput = {
  invoiceId?: string;
  intervalDays?: number;
  maxReminders?: number;
  enabled?: boolean;
};

export type ReminderSchedule = ReminderScheduleInput & {
  id: string;
  userId: string;
  remindersSent: number;
  lastSentAt?: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(
  row: typeof paymentReminderSchedule.$inferSelect
): ReminderSchedule {
  return {
    id: row.id,
    userId: row.userId,
    invoiceId: row.invoiceId ?? undefined,
    intervalDays: row.intervalDays,
    maxReminders: row.maxReminders,
    remindersSent: row.remindersSent,
    lastSentAt: row.lastSentAt?.toISOString(),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listReminderSchedules(
  userId: string
): Promise<ReminderSchedule[]> {
  const rows = await db
    .select()
    .from(paymentReminderSchedule)
    .where(eq(paymentReminderSchedule.userId, userId));
  return rows.map(mapRow);
}

export async function upsertReminderSchedule(
  userId: string,
  input: ReminderScheduleInput & { id?: string }
): Promise<ReminderSchedule> {
  const now = new Date();

  if (input.id) {
    const [row] = await db
      .update(paymentReminderSchedule)
      .set({
        invoiceId: input.invoiceId ?? null,
        intervalDays: input.intervalDays ?? 7,
        maxReminders: input.maxReminders ?? 3,
        enabled: input.enabled ?? true,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentReminderSchedule.id, input.id),
          eq(paymentReminderSchedule.userId, userId)
        )
      )
      .returning();
    return mapRow(row);
  }

  const id = createId();
  const [row] = await db
    .insert(paymentReminderSchedule)
    .values({
      id,
      userId,
      invoiceId: input.invoiceId ?? null,
      intervalDays: input.intervalDays ?? 7,
      maxReminders: input.maxReminders ?? 3,
      remindersSent: 0,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function getDefaultSchedule(
  userId: string
): Promise<ReminderSchedule | null> {
  const [row] = await db
    .select()
    .from(paymentReminderSchedule)
    .where(
      and(
        eq(paymentReminderSchedule.userId, userId),
        isNull(paymentReminderSchedule.invoiceId)
      )
    )
    .limit(1);

  return row ? mapRow(row) : null;
}
