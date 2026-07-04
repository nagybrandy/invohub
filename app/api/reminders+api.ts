// app/api/reminders+api.ts
// Reminder schedule list and create.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  listReminderSchedules,
  upsertReminderSchedule,
} from "@/lib/reminders/service";
import type { ReminderScheduleInput } from "@/lib/reminders/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const schedules = await listReminderSchedules(session.user.id);
  return jsonResponse({ schedules });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as ReminderScheduleInput & { id?: string };
  const schedule = await upsertReminderSchedule(session.user.id, body);
  return jsonResponse({ schedule }, 201);
}
