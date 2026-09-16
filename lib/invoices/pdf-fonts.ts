// lib/invoices/pdf-fonts.ts
// Embeds a Latin-Extended-A TrueType font (Noto Sans, see
// assets/fonts/pdf/README.md) into an invoice PDF so ő/ű render correctly.
//
// IMPORTANT — do not register these fonts under pdfkit's base-14 names
// ("Helvetica"/"Helvetica-Bold"). Verified against this repo's pdfkit
// 0.19.1 (see docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md §1):
// registering a TTF under a base-14 name silently falls back to pdfkit's
// built-in WinAnsi (cp1252) font on `doc.font(name)` and produces garbage —
// `doc._font` stays a StandardFont, never the EmbeddedFont the TTF gives
// you. The names below are deliberately non-standard.
import fs from "node:fs";
import path from "node:path";
import type PDFDocument from "pdfkit";
import { collectSearchRoots } from "@/lib/invoices/pdf-document";

type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

export const PDF_FONT_REGULAR = "InvoHubSans";
export const PDF_FONT_BOLD = "InvoHubSans-Bold";
export const FALLBACK_FONT_REGULAR = "Helvetica";
export const FALLBACK_FONT_BOLD = "Helvetica-Bold";

export type DocumentFonts = { regular: string; bold: string; embedded: boolean };

const FONT_FILENAMES = {
  regular: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
};

function fontDirCandidates(root: string): string[] {
  return [
    path.join(root, "dist/server/assets/pdf-fonts"),
    path.join(root, "assets/fonts/pdf"),
  ];
}

/**
 * Locates the vendored TTF pair, reusing pdf-document.ts's exact bundle
 * search strategy (dist/server first, repo assets as the local/dev
 * fallback). Not cached at module level (deliberately — the check is a
 * couple of cheap fs.existsSync calls, and not caching keeps this
 * re-resolvable per call rather than pinned to whatever the process's first
 * caller happened to find, which matters for tests exercising both the
 * embedded and fallback paths in the same run).
 */
export function resolvePdfFontFiles(): { regular: string; bold: string } | null {
  for (const root of collectSearchRoots()) {
    for (const dir of fontDirCandidates(root)) {
      const regular = path.join(dir, FONT_FILENAMES.regular);
      const bold = path.join(dir, FONT_FILENAMES.bold);
      if (fs.existsSync(regular) && fs.existsSync(bold)) {
        return { regular, bold };
      }
    }
  }
  return null;
}

/**
 * Registers the embedded fonts on `doc` and returns the names to draw with.
 * Falls back to pdfkit's built-in Helvetica (with a console.error left for
 * the caller to log once) when the TTFs cannot be resolved — this must
 * never throw, since a PDF with the wrong font is far better than no PDF.
 */
export function registerDocumentFonts(doc: PdfDocumentInstance): DocumentFonts {
  const files = resolvePdfFontFiles();
  if (!files) {
    return { embedded: false, regular: FALLBACK_FONT_REGULAR, bold: FALLBACK_FONT_BOLD };
  }

  doc.registerFont(PDF_FONT_REGULAR, files.regular);
  doc.registerFont(PDF_FONT_BOLD, files.bold);
  return { embedded: true, regular: PDF_FONT_REGULAR, bold: PDF_FONT_BOLD };
}

/**
 * Reads back which font names are usable on `doc` right now — no
 * module-level "current font" state, so this stays correct under concurrent
 * requests each holding their own pdfkit document.
 */
export function documentFontNames(doc: PdfDocumentInstance): { regular: string; bold: string } {
  const registered = (doc as unknown as { _registeredFonts?: Record<string, unknown> })
    ._registeredFonts;
  if (registered && PDF_FONT_REGULAR in registered) {
    return { regular: PDF_FONT_REGULAR, bold: PDF_FONT_BOLD };
  }
  return { regular: FALLBACK_FONT_REGULAR, bold: FALLBACK_FONT_BOLD };
}
