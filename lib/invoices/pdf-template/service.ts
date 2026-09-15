// lib/invoices/pdf-template/service.ts
// Persist and load per-user invoice PDF template settings.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoicePdfTemplate } from "@/db/schema";
import { createId } from "@/lib/id";
import {
  DEFAULT_PDF_TEMPLATE,
  mergePdfTemplate,
  normalizeHexColor,
} from "@/lib/invoices/pdf-template/defaults";
import type {
  InvoicePdfTemplate,
  InvoicePdfTemplateInput,
} from "@/lib/invoices/pdf-template/types";

function mapRow(row: typeof invoicePdfTemplate.$inferSelect): InvoicePdfTemplate {
  return mergePdfTemplate({
    titleText: row.titleText,
    // Normalized again at read time, not just on write (upsertPdfTemplate
    // below) — the render path's safety must not depend on every past and
    // future write path having validated it (a legacy row, a direct DB
    // edit, a future write path that forgets to call normalizeHexColor).
    accentColor: normalizeHexColor(row.accentColor),
    showCompanyBlock: row.showCompanyBlock,
    showBankDetails: row.showBankDetails,
    showClientTaxNumber: row.showClientTaxNumber,
    footerText: row.footerText ?? DEFAULT_PDF_TEMPLATE.footerText,
    notesLabel: row.notesLabel,
    fontScale: row.fontScale as InvoicePdfTemplate["fontScale"],
  });
}

export async function getPdfTemplate(userId: string): Promise<InvoicePdfTemplate> {
  const [row] = await db
    .select()
    .from(invoicePdfTemplate)
    .where(eq(invoicePdfTemplate.userId, userId))
    .limit(1);

  return row ? mapRow(row) : { ...DEFAULT_PDF_TEMPLATE };
}

export async function upsertPdfTemplate(
  userId: string,
  input: InvoicePdfTemplateInput
): Promise<InvoicePdfTemplate> {
  const merged = mergePdfTemplate(input);
  const normalized: InvoicePdfTemplate = {
    ...merged,
    titleText: merged.titleText.trim() || DEFAULT_PDF_TEMPLATE.titleText,
    accentColor: normalizeHexColor(merged.accentColor),
    footerText: merged.footerText.trim(),
    notesLabel: merged.notesLabel.trim() || DEFAULT_PDF_TEMPLATE.notesLabel,
  };

  const now = new Date();
  const [existing] = await db
    .select()
    .from(invoicePdfTemplate)
    .where(eq(invoicePdfTemplate.userId, userId))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(invoicePdfTemplate)
      .set({
        titleText: normalized.titleText,
        accentColor: normalized.accentColor,
        showCompanyBlock: normalized.showCompanyBlock,
        showBankDetails: normalized.showBankDetails,
        showClientTaxNumber: normalized.showClientTaxNumber,
        footerText: normalized.footerText,
        notesLabel: normalized.notesLabel,
        fontScale: normalized.fontScale,
        updatedAt: now,
      })
      .where(eq(invoicePdfTemplate.id, existing.id))
      .returning();
    return mapRow(row);
  }

  const [row] = await db
    .insert(invoicePdfTemplate)
    .values({
      id: createId(),
      userId,
      titleText: normalized.titleText,
      accentColor: normalized.accentColor,
      showCompanyBlock: normalized.showCompanyBlock,
      showBankDetails: normalized.showBankDetails,
      showClientTaxNumber: normalized.showClientTaxNumber,
      footerText: normalized.footerText,
      notesLabel: normalized.notesLabel,
      fontScale: normalized.fontScale,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapRow(row);
}
