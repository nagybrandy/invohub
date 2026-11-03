// lib/invoices/pdf-template/service.ts
// Persist and load per-user invoice PDF template settings, and the per-invoice
// appearance snapshot frozen at issue time (invoice.pdf_template_snapshot).
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoicePdfTemplate } from "@/db/schema";
import { createId } from "@/lib/id";
import {
  DEFAULT_PDF_TEMPLATE,
  mergePdfTemplate,
  normalizeHexColor,
  parsePdfTemplateSnapshot,
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

/**
 * The appearance an issued invoice was issued with (set by upsertInvoice when
 * it assigns the number). null for a draft, an invoice issued before
 * snapshots existed, or an id that isn't this user's — callers fall back to
 * the live template.
 */
export async function getInvoicePdfTemplateSnapshot(
  userId: string,
  invoiceId: string
): Promise<InvoicePdfTemplate | null> {
  const [row] = await db
    .select({ pdfTemplateSnapshot: invoice.pdfTemplateSnapshot })
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, userId)))
    .limit(1);
  return parsePdfTemplateSnapshot(row?.pdfTemplateSnapshot);
}

/**
 * Issued invoices without a snapshot (issued before snapshots existed) render
 * with the live template, so before it changes, freeze the look they have had
 * so far onto them — a template change then only affects invoices issued from
 * now on. Idempotent: once set, a snapshot is never overwritten.
 */
async function freezeAppearanceOfUnsnapshottedInvoices(
  userId: string,
  current: InvoicePdfTemplate
): Promise<void> {
  await db
    .update(invoice)
    .set({ pdfTemplateSnapshot: current })
    .where(
      and(
        eq(invoice.userId, userId),
        ne(invoice.status, "draft"),
        ne(invoice.invoiceNumber, ""),
        isNull(invoice.pdfTemplateSnapshot)
      )
    );
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

  await freezeAppearanceOfUnsnapshottedInvoices(
    userId,
    existing ? mapRow(existing) : { ...DEFAULT_PDF_TEMPLATE }
  );

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
