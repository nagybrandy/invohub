// lib/email/templates/service.ts
// Email template CRUD and default seeding.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailTemplate } from "@/db/schema";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/templates/defaults";
import type { EmailTemplateType } from "@/lib/email/templates/types";
import { createId } from "@/lib/id";

export type EmailTemplateRecord = {
  id: string;
  userId: string;
  type: EmailTemplateType;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof emailTemplate.$inferSelect): EmailTemplateRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as EmailTemplateType,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEmailTemplates(
  userId: string
): Promise<EmailTemplateRecord[]> {
  await seedDefaultTemplates(userId);
  const rows = await db
    .select()
    .from(emailTemplate)
    .where(eq(emailTemplate.userId, userId));
  return rows.map(mapRow);
}

export async function getEmailTemplateByType(
  userId: string,
  type: EmailTemplateType
): Promise<EmailTemplateRecord | null> {
  await seedDefaultTemplates(userId);
  const [row] = await db
    .select()
    .from(emailTemplate)
    .where(and(eq(emailTemplate.userId, userId), eq(emailTemplate.type, type)));
  return row ? mapRow(row) : null;
}

export async function updateEmailTemplate(
  userId: string,
  id: string,
  input: { subject?: string; bodyHtml?: string; bodyText?: string }
): Promise<EmailTemplateRecord | null> {
  const [existing] = await db
    .select()
    .from(emailTemplate)
    .where(and(eq(emailTemplate.id, id), eq(emailTemplate.userId, userId)));

  if (!existing) return null;

  const now = new Date();
  const [row] = await db
    .update(emailTemplate)
    .set({
      subject: input.subject ?? existing.subject,
      bodyHtml: input.bodyHtml ?? existing.bodyHtml,
      bodyText: input.bodyText ?? existing.bodyText,
      updatedAt: now,
    })
    .where(eq(emailTemplate.id, id))
    .returning();
  return mapRow(row);
}

export async function seedDefaultTemplates(userId: string): Promise<void> {
  const existing = await db
    .select({ id: emailTemplate.id })
    .from(emailTemplate)
    .where(eq(emailTemplate.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date();
  await db.insert(emailTemplate).values(
    DEFAULT_EMAIL_TEMPLATES.map((tpl) => ({
      id: createId(),
      userId,
      type: tpl.type,
      subject: tpl.subject,
      bodyHtml: tpl.bodyHtml,
      bodyText: tpl.bodyText,
      createdAt: now,
      updatedAt: now,
    }))
  );
}
