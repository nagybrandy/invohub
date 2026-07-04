// lib/reminders/process.ts
// Scans overdue invoices and sends payment reminder emails.
import { addDays, isBefore, parseISO } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoice, paymentReminderSchedule } from "@/db/schema";
import { getCompanyByUserId } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { renderTemplate } from "@/lib/email/templates/render";
import { getEmailTemplateByType } from "@/lib/email/templates/service";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { INVOICE_LIST_MAX_LIMIT } from "@/lib/invoices/constants";
import { listInvoices } from "@/lib/invoices/service";

export type ReminderProcessResult = {
  processed: number;
  sent: number;
  errors: string[];
};

export async function processPaymentReminders(
  userId?: string
): Promise<ReminderProcessResult> {
  const result: ReminderProcessResult = { processed: 0, sent: 0, errors: [] };
  const now = new Date();

  const schedules = await db.select().from(paymentReminderSchedule).where(
    userId
      ? eq(paymentReminderSchedule.userId, userId)
      : eq(paymentReminderSchedule.enabled, true)
  );

  const usersToProcess = userId
    ? [userId]
    : [...new Set(schedules.map((s) => s.userId))];

  for (const uid of usersToProcess) {
    const userSchedules = schedules.filter((s) => s.userId === uid && s.enabled);
    const defaultSchedule = userSchedules.find((s) => !s.invoiceId);
    const { invoices } = await listInvoices(uid, { limit: INVOICE_LIST_MAX_LIMIT });
    const company = await getCompanyByUserId(uid);

    for (const inv of invoices) {
      if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") {
        continue;
      }

      const dueDate = parseISO(inv.dueDate);
      if (!isBefore(dueDate, now)) continue;

      const schedule =
        userSchedules.find((s) => s.invoiceId === inv.id) ?? defaultSchedule;
      if (!schedule) continue;
      if (schedule.remindersSent >= schedule.maxReminders) continue;

      const lastSent = schedule.lastSentAt ?? new Date(0);
      const nextDue = addDays(lastSent, schedule.intervalDays);
      if (!isBefore(nextDue, now)) continue;

      result.processed += 1;

      const template = await getEmailTemplateByType(uid, "payment_reminder");
      if (!template) {
        result.errors.push(`No template for user ${uid}`);
        continue;
      }

      const totals = calculateInvoiceTotals(inv.lineItems);
      const vars = {
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        total: formatCurrency(totals.totalAmount, inv.currency),
        dueDate: inv.dueDate,
        paymentLink: "",
        companyName: company?.name ?? "InvoHub",
      };

      const sendResult = await sendEmail({
        to: inv.clientName.includes("@") ? inv.clientName : "client@example.com",
        subject: renderTemplate(template.subject, vars),
        html: renderTemplate(template.bodyHtml, vars),
        text: renderTemplate(template.bodyText ?? template.bodyHtml, vars),
      });

      if (sendResult.ok) {
        result.sent += 1;
        await db
          .update(paymentReminderSchedule)
          .set({
            remindersSent: schedule.remindersSent + 1,
            lastSentAt: now,
            updatedAt: now,
          })
          .where(eq(paymentReminderSchedule.id, schedule.id));

        await db
          .update(invoice)
          .set({ status: "overdue", updatedAt: now })
          .where(and(eq(invoice.id, inv.id), eq(invoice.userId, uid)));
      } else if (sendResult.error) {
        result.errors.push(sendResult.error);
      }
    }
  }

  return result;
}
