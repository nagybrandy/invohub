// lib/invoices/pdf-template/defaults.ts
// PDF template defaults. TWO default sets exist on purpose:
//   - LEGACY_PDF_TEMPLATE: today's values, frozen forever. Used for the legacy
//     renderer and to read old data (snapshots / rows written before the
//     2026-11 paper redesign), so an issued invoice never changes appearance.
//   - DEFAULT_PDF_TEMPLATE: Dóri's design (Letisztult layout), for new users and
//     "restore defaults".
import type {
  InvoicePdfTemplate,
  PdfFontScale,
  PdfFontStyle,
  PdfLayout,
  PdfLogoMode,
  PdfLogoPosition,
  PdfLogoSize,
} from "@/lib/invoices/pdf-template/types";

/** Today's look, frozen. Never edit these values: issued invoices depend on them. */
export const LEGACY_PDF_TEMPLATE: InvoicePdfTemplate = Object.freeze({
  titleText: "SZÁMLA",
  accentColor: "#6495ed",
  showCompanyBlock: true,
  showBankDetails: true,
  showClientTaxNumber: true,
  footerText: "Köszönjük a bizalmat!",
  notesLabel: "Megjegyzés",
  fontScale: "medium",
  layout: "legacy",
  fontStyle: "invohub",
  logoMode: "monogram",
  logoSize: "M",
  logoPosition: "left",
}) as InvoicePdfTemplate;

/** Dóri's "Alapértelmezés visszaállítása" selection (new users, reset). */
export const DEFAULT_PDF_TEMPLATE: InvoicePdfTemplate = Object.freeze({
  titleText: "SZÁMLA",
  accentColor: "#3F6BC4",
  showCompanyBlock: true,
  showBankDetails: true,
  showClientTaxNumber: true,
  footerText: "Köszönjük a bizalmát!",
  notesLabel: "Megjegyzés",
  fontScale: "medium",
  layout: "clean",
  fontStyle: "invohub",
  logoMode: "monogram",
  logoSize: "M",
  logoPosition: "left",
}) as InvoicePdfTemplate;

export const PDF_FONT_SCALES: PdfFontScale[] = ["small", "medium", "large"];
export const PDF_LAYOUTS: PdfLayout[] = ["legacy", "clean", "band", "frame"];
/**
 * The layouts a user can pick and a client may send. "legacy" is read-only:
 * it still exists to draw invoices issued before the redesign, but is never
 * offered nor accepted for new writes.
 */
export const PDF_SELECTABLE_LAYOUTS: PdfLayout[] = ["clean", "band", "frame"];
export const PDF_FONT_STYLES: PdfFontStyle[] = ["invohub", "classic", "round"];
export const PDF_LOGO_MODES: PdfLogoMode[] = ["monogram", "own", "none"];
export const PDF_LOGO_SIZES: PdfLogoSize[] = ["S", "M", "L"];
export const PDF_LOGO_POSITIONS: PdfLogoPosition[] = ["left", "right"];

/** The default set a template of this layout is compared against. */
export function defaultsForLayout(layout: PdfLayout | undefined): InvoicePdfTemplate {
  return layout === undefined || layout === "legacy" ? LEGACY_PDF_TEMPLATE : DEFAULT_PDF_TEMPLATE;
}

export function pdfFontSizes(scale: PdfFontScale): {
  title: number;
  subtitle: number;
  body: number;
  small: number;
} {
  switch (scale) {
    case "small":
      return { title: 16, subtitle: 11, body: 8, small: 8 };
    case "large":
      return { title: 24, subtitle: 13, body: 10, small: 9 };
    case "medium":
    default:
      return { title: 20, subtitle: 12, body: 9, small: 9 };
  }
}

/**
 * Merges `input` onto `base` (Dóri's defaults unless told otherwise); an
 * undefined value never overrides. Callers merging a stored or legacy
 * template pass the matching base, never rely on the default.
 */
export function mergePdfTemplate(
  input: Partial<InvoicePdfTemplate> | null | undefined,
  base: InvoicePdfTemplate = DEFAULT_PDF_TEMPLATE
): InvoicePdfTemplate {
  const defined = Object.fromEntries(
    Object.entries(input ?? {}).filter(([, value]) => value !== undefined)
  );
  return { ...base, ...defined };
}

/**
 * Applies a client's partial `input` onto the template the user has STORED
 * (or Dóri's defaults for a user without one). An omitted field means "as
 * saved", so an older client or a partial body never moves a legacy row to
 * the new design by accident.
 *
 * When the change moves a LEGACY row onto a paper layout, the values the user
 * never edited (still exactly the legacy defaults: cornflower accent, the old
 * footer text, ...) become Dóri's defaults for that field, unless the input
 * sets that field explicitly. Without this a layout-only PATCH would keep the
 * legacy accent colour and the legacy footer (an English invoice would then
 * print the Hungarian footer, see localizePdfTemplate).
 */
export function applyPdfTemplateInput(
  stored: InvoicePdfTemplate,
  input: Partial<InvoicePdfTemplate> | null | undefined
): InvoicePdfTemplate {
  const merged = mergePdfTemplate(input, stored);
  if (stored.layout !== "legacy" || merged.layout === "legacy") return merged;
  const out: InvoicePdfTemplate = { ...merged };
  for (const key of ["accentColor", "footerText", "notesLabel", "titleText"] as const) {
    const explicit = input?.[key] !== undefined;
    if (!explicit && stored[key].toLowerCase() === LEGACY_PDF_TEMPLATE[key].toLowerCase()) {
      out[key] = DEFAULT_PDF_TEMPLATE[key];
    }
  }
  return out;
}

/**
 * THE one place a stored `legacy` template becomes Letisztult (`clean`). Used
 * for everything that is NOT an already-issued invoice: drafts, the sample
 * preview, the settings screen and the appearance frozen onto an invoice as
 * it gets its number. Values the user never edited (still the legacy
 * defaults) take Dóri's defaults, exactly like picking a new layout does.
 * Issued invoices never go through this: they render their stored snapshot
 * (or the legacy appearance when they have none).
 */
export function resolveLiveTemplate(template: InvoicePdfTemplate): InvoicePdfTemplate {
  return template.layout === "legacy" ? applyPdfTemplateInput(template, { layout: "clean" }) : template;
}

/**
 * A strict #rrggbb colour, else `fallback`. The default fallback is the
 * frozen LEGACY accent: the legacy renderer (and every pre-redesign caller)
 * relies on it; new-layout callers pass DEFAULT_PDF_TEMPLATE.accentColor.
 */
export function normalizeHexColor(
  color: string,
  fallback: string = LEGACY_PDF_TEMPLATE.accentColor
): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  return fallback;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Reads an invoice's stored appearance snapshot (invoice.pdf_template_snapshot,
 * untyped JSON) back into a template. null when there is none. Only the known
 * fields of the right type are kept — anything else falls back to the LEGACY
 * value — and the colour is normalized, for the same reason getPdfTemplate
 * re-normalizes its row: render safety must not depend on what is stored.
 *
 * A snapshot without a layout (every snapshot written before the paper
 * redesign) or with an unknown one is a legacy snapshot and renders exactly
 * as it did when it was issued.
 */
export function parsePdfTemplateSnapshot(value: unknown): InvoicePdfTemplate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const legacy = LEGACY_PDF_TEMPLATE;
  const text = (key: "titleText" | "footerText" | "notesLabel") =>
    typeof raw[key] === "string" ? (raw[key] as string) : legacy[key];
  const flag = (key: "showCompanyBlock" | "showBankDetails" | "showClientTaxNumber") =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : legacy[key];
  return {
    titleText: text("titleText"),
    accentColor: normalizeHexColor(typeof raw.accentColor === "string" ? raw.accentColor : ""),
    showCompanyBlock: flag("showCompanyBlock"),
    showBankDetails: flag("showBankDetails"),
    showClientTaxNumber: flag("showClientTaxNumber"),
    footerText: text("footerText"),
    notesLabel: text("notesLabel"),
    fontScale: oneOf(PDF_FONT_SCALES, raw.fontScale, legacy.fontScale),
    layout: oneOf(PDF_LAYOUTS, raw.layout, legacy.layout),
    fontStyle: oneOf(PDF_FONT_STYLES, raw.fontStyle, legacy.fontStyle),
    logoMode: oneOf(PDF_LOGO_MODES, raw.logoMode, legacy.logoMode),
    logoSize: oneOf(PDF_LOGO_SIZES, raw.logoSize, legacy.logoSize),
    logoPosition: oneOf(PDF_LOGO_POSITIONS, raw.logoPosition, legacy.logoPosition),
  };
}

const ENGLISH_DEFAULTS = {
  titleText: "INVOICE",
  footerText: "Thank you for your business!",
  notesLabel: "Note",
} as const;

/**
 * For an English document the three DEFAULT Hungarian template texts become
 * their English equivalents. A text the user customised (anything that is not
 * exactly the default OF THE TEMPLATE'S OWN SET — legacy or Dóri's) is theirs
 * and is left alone.
 */
export function localizePdfTemplate(
  template: InvoicePdfTemplate,
  locale: "hu" | "en"
): InvoicePdfTemplate {
  if (locale !== "en") return template;
  const defaults = defaultsForLayout(template.layout);
  // A paper layout also treats the legacy default footer as a default: a row
  // that was switched from legacy to a paper layout by an older client may
  // still carry it, and an English invoice must not print Hungarian.
  const isDefaultFooter =
    template.footerText === defaults.footerText ||
    (template.layout !== "legacy" && template.footerText === LEGACY_PDF_TEMPLATE.footerText);
  return {
    ...template,
    titleText: template.titleText === defaults.titleText ? ENGLISH_DEFAULTS.titleText : template.titleText,
    footerText: isDefaultFooter ? ENGLISH_DEFAULTS.footerText : template.footerText,
    notesLabel: template.notesLabel === defaults.notesLabel ? ENGLISH_DEFAULTS.notesLabel : template.notesLabel,
  };
}
