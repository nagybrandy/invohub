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
import type { PdfFontStyle } from "@/lib/invoices/pdf-template/types";

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

// ---------------------------------------------------------------------------
// Paper fonts (2026-11 redesign): three heading + body pairings, all SIL OFL
// static TTFs vendored under assets/fonts/pdf/<dir>/ (provenance in the README
// there) and copied to dist/server/assets/pdf-fonts/<dir>/ by
// scripts/prepare-server-pdf-deps.mjs.
// ---------------------------------------------------------------------------

export type PaperFontRole = "head500" | "head600" | "head700" | "body400" | "body700";
export const PAPER_FONT_ROLES: PaperFontRole[] = ["head500", "head600", "head700", "body400", "body700"];

/** Files per font style, relative to the pdf-fonts root (dist/server/assets/pdf-fonts or assets/fonts/pdf). */
export const PAPER_FONT_FILES: Record<PdfFontStyle, Record<PaperFontRole, string>> = {
  invohub: {
    head500: "stack-sans/StackSansNotch-Medium.ttf",
    head600: "stack-sans/StackSansNotch-SemiBold.ttf",
    head700: "stack-sans/StackSansNotch-Bold.ttf",
    body400: "stack-sans/StackSansText-Regular.ttf",
    body700: "stack-sans/StackSansText-Bold.ttf",
  },
  classic: {
    head500: "source/SourceSerif4-Medium.ttf",
    head600: "source/SourceSerif4-SemiBold.ttf",
    head700: "source/SourceSerif4-Bold.ttf",
    body400: "source/SourceSans3-Regular.ttf",
    body700: "source/SourceSans3-Bold.ttf",
  },
  round: {
    head500: "nunito/Nunito-Medium.ttf",
    head600: "nunito/Nunito-SemiBold.ttf",
    head700: "nunito/Nunito-Bold.ttf",
    body400: "nunito/NunitoSans-Regular.ttf",
    body700: "nunito/NunitoSans-Bold.ttf",
  },
};

/** Every vendored paper font file (15), for the bundling scripts and tests. */
export const ALL_PAPER_FONT_FILES: string[] = Object.values(PAPER_FONT_FILES).flatMap((files) =>
  Object.values(files)
);

export type PaperFonts = Record<PaperFontRole, string> & {
  /** False only on the Helvetica last resort (ő/ű must be transliterated by the caller). */
  embedded: boolean;
  /** Which family actually got registered. */
  source: "style" | "noto" | "helvetica";
};

const fontBufferCache = new Map<string, Buffer>();

function readFontBuffer(file: string): Buffer {
  let buffer = fontBufferCache.get(file);
  if (!buffer) {
    buffer = fs.readFileSync(file);
    fontBufferCache.set(file, buffer);
  }
  return buffer;
}

/** Absolute paths of a style's five files, or null unless all five exist in one font root. */
export function resolvePaperFontFiles(style: PdfFontStyle): Record<PaperFontRole, string> | null {
  const wanted = PAPER_FONT_FILES[style];
  for (const root of collectSearchRoots()) {
    for (const dir of fontDirCandidates(root)) {
      const resolved = {} as Record<PaperFontRole, string>;
      let complete = true;
      for (const role of PAPER_FONT_ROLES) {
        const file = path.join(dir, wanted[role]);
        if (!fs.existsSync(file)) {
          complete = false;
          break;
        }
        resolved[role] = file;
      }
      if (complete) return resolved;
    }
  }
  return null;
}

let warnedPaperFontFallback = false;

/**
 * Registers the five fonts of `style` on `doc` under non-base-14 names
 * (IHPaper-<style>-<role>); buffers are read once per process. If the style's
 * files are missing, every role falls back to the Noto Sans pair, and if that
 * is missing too to Helvetica (embedded: false). Never throws.
 */
export function registerPaperFonts(doc: PdfDocumentInstance, style: PdfFontStyle): PaperFonts {
  const files = resolvePaperFontFiles(style);
  if (files) {
    const names = {} as Record<PaperFontRole, string>;
    for (const role of PAPER_FONT_ROLES) {
      const name = `IHPaper-${style}-${role}`;
      doc.registerFont(name, readFontBuffer(files[role]));
      names[role] = name;
    }
    return { ...names, embedded: true, source: "style" };
  }

  if (!warnedPaperFontFallback) {
    warnedPaperFontFallback = true;
    console.error(
      `registerPaperFonts: the "${style}" paper fonts are unresolvable, falling back to Noto Sans / Helvetica`
    );
  }
  const noto = registerDocumentFonts(doc);
  return {
    head500: noto.regular,
    head600: noto.bold,
    head700: noto.bold,
    body400: noto.regular,
    body700: noto.bold,
    embedded: noto.embedded,
    source: noto.embedded ? "noto" : "helvetica",
  };
}
