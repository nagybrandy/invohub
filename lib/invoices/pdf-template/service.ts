// lib/invoices/pdf-template/service.ts
// Persist and load per-user invoice PDF template settings, and the per-invoice
// appearance snapshot frozen at issue time (invoice.pdf_template_snapshot).
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoicePdfTemplate } from "@/db/schema";
import { createId } from "@/lib/id";
import {
  DEFAULT_PDF_TEMPLATE,
  LEGACY_PDF_TEMPLATE,
  PDF_FONT_SCALES,
  PDF_FONT_STYLES,
  PDF_LAYOUTS,
  PDF_LOGO_MODES,
  PDF_LOGO_POSITIONS,
  PDF_LOGO_SIZES,
  defaultsForLayout,
  mergePdfTemplate,
  normalizeHexColor,
  parsePdfTemplateSnapshot,
} from "@/lib/invoices/pdf-template/defaults";
import type {
  InvoicePdfTemplate,
  InvoicePdfTemplateInput,
} from "@/lib/invoices/pdf-template/types";

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function mapRow(row: typeof invoicePdfTemplate.$inferSelect): InvoicePdfTemplate {
  // An unknown layout reads as legacy (never as a new design): the stored row
  // is what an unsnapshotted issued invoice may still be drawn from.
  const layout = oneOf(PDF_LAYOUTS, row.layout, LEGACY_PDF_TEMPLATE.layout);
  const defaults = defaultsForLayout(layout);
  return mergePdfTemplate(
    {
      titleText: row.titleText,
      // Normalized again at read time, not just on write (upsertPdfTemplate
      // below) — the render path's safety must not depend on every past and
      // future write path having validated it (a legacy row, a direct DB
      // edit, a future write path that forgets to call normalizeHexColor).
      accentColor: normalizeHexColor(row.accentColor, defaults.accentColor),
      showCompanyBlock: row.showCompanyBlock,
      showBankDetails: row.showBankDetails,
      showClientTaxNumber: row.showClientTaxNumber,
      footerText: row.footerText ?? defaults.footerText,
      notesLabel: row.notesLabel,
      fontScale: oneOf(PDF_FONT_SCALES, row.fontScale, defaults.fontScale),
      layout,
      fontStyle: oneOf(PDF_FONT_STYLES, row.fontStyle, defaults.fontStyle),
      logoMode: oneOf(PDF_LOGO_MODES, row.logoMode, defaults.logoMode),
      logoSize: oneOf(PDF_LOGO_SIZES, row.logoSize, defaults.logoSize),
      logoPosition: oneOf(PDF_LOGO_POSITIONS, row.logoPosition, defaults.logoPosition),
    },
    defaults
  );
}

/**
 * The look an issued invoice WITHOUT a snapshot has always been drawn with:
 * the user's stored template (or the frozen legacy values for a user without
 * a row) rendered by the legacy renderer. Never the new-user defaults and
 * never a paper layout — everything issued before snapshots existed was
 * drawn by the legacy code.
 */
function legacyAppearanceOf(row: typeof invoicePdfTemplate.$inferSelect | undefined): InvoicePdfTemplate {
  return { ...(row ? mapRow(row) : LEGACY_PDF_TEMPLATE), layout: "legacy" };
}

export async function getLegacyAppearance(userId: string): Promise<InvoicePdfTemplate> {
  const [row] = await db
    .select()
    .from(invoicePdfTemplate)
    .where(eq(invoicePdfTemplate.userId, userId))
    .limit(1);
  return legacyAppearanceOf(row);
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
 * with the live template (getLegacyAppearance), so before it changes, freeze
 * the look they have had so far onto them — a template change then only
 * affects invoices issued from now on. `current` must be the LEGACY
 * appearance. Idempotent: once set, a snapshot is never overwritten.
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
  const now = new Date();
  const [existing] = await db
    .select()
    .from(invoicePdfTemplate)
    .where(eq(invoicePdfTemplate.userId, userId))
    .limit(1);

  // Merge onto what the user has stored, not onto the new-user defaults: a
  // PATCH that omits `layout` (any older client) must not silently move a
  // legacy row to the new design.
  const base = existing ? mapRow(existing) : DEFAULT_PDF_TEMPLATE;
  const merged = mergePdfTemplate(input, base);
  const defaults = defaultsForLayout(merged.layout);
  const normalized: InvoicePdfTemplate = {
    ...merged,
    titleText: merged.titleText.trim() || defaults.titleText,
    accentColor: normalizeHexColor(merged.accentColor, defaults.accentColor),
    footerText: merged.footerText.trim(),
    notesLabel: merged.notesLabel.trim() || defaults.notesLabel,
  };

  await freezeAppearanceOfUnsnapshottedInvoices(userId, legacyAppearanceOf(existing));

  const columns = {
    titleText: normalized.titleText,
    accentColor: normalized.accentColor,
    showCompanyBlock: normalized.showCompanyBlock,
    showBankDetails: normalized.showBankDetails,
    showClientTaxNumber: normalized.showClientTaxNumber,
    footerText: normalized.footerText,
    notesLabel: normalized.notesLabel,
    fontScale: normalized.fontScale,
    layout: normalized.layout,
    fontStyle: normalized.fontStyle,
    logoMode: normalized.logoMode,
    logoSize: normalized.logoSize,
    logoPosition: normalized.logoPosition,
  };

  if (existing) {
    const [row] = await db
      .update(invoicePdfTemplate)
      .set({ ...columns, updatedAt: now })
      .where(eq(invoicePdfTemplate.id, existing.id))
      .returning();
    return mapRow(row);
  }

  const [row] = await db
    .insert(invoicePdfTemplate)
    .values({
      id: createId(),
      userId,
      ...columns,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return mapRow(row);
}
