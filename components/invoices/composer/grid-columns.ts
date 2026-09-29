// components/invoices/composer/grid-columns.ts
// The single source of truth for the step-2 line-item grid's column widths
// (used by both StepLineItems' header and LineItemRow's desktop cells, so
// they cannot drift — composer-line-item-horizontal-scroll-1440) and for the
// layout arithmetic behind it: how much horizontal room the form column
// actually gets at a given viewport once the sidebar and (on Partner/
// Ellenőrzés) the 400px ComposerSummary are subtracted.
//
// className strings below are literal so NativeWind's content scan can find
// them (a dynamically interpolated `w-[${n}px]` would not be picked up) —
// see docs/decisions/2026-09-18-composer-items-step-full-width-grid.md.

export type ComposerGridColumn = {
  key: string;
  /** i18n key for the header label, or "" for a column with no header text. */
  labelKey: string;
  /** Column width in px — also what composerGridMinWidth() sums. */
  minWidth: number;
  /** True for the one column that grows to fill remaining space. */
  flex?: boolean;
  /** Static Tailwind class encoding the same minWidth (+ alignment). */
  className: string;
};

/** Horizontal gap between grid columns, in px (HStack space="sm" = 8px). */
export const GRID_COLUMN_GAP = 8;

export const COMPOSER_GRID_COLUMNS: ComposerGridColumn[] = [
  {
    key: "description",
    labelKey: "invoices.lineItemEditor.description",
    minWidth: 240,
    flex: true,
    className: "min-w-[240px] flex-1",
  },
  {
    key: "quantityUnit",
    labelKey: "invoices.lineItemEditor.quantityUnit",
    minWidth: 132,
    className: "w-[132px]",
  },
  {
    key: "unitPrice",
    labelKey: "invoices.lineItemEditor.unitPrice",
    minWidth: 132,
    className: "w-[132px]",
  },
  {
    key: "vat",
    labelKey: "invoices.vat.categoryLabel",
    minWidth: 132,
    className: "w-[132px]",
  },
  {
    key: "amount",
    labelKey: "invoices.lineItemEditor.amountColumn",
    minWidth: 140,
    className: "w-[140px] items-end",
  },
  {
    key: "actions",
    labelKey: "",
    minWidth: 44,
    className: "w-11 items-center",
  },
];

/** Sum of the 6 column widths plus the gaps between them — 860px. */
export function composerGridMinWidth(): number {
  const widthSum = COMPOSER_GRID_COLUMNS.reduce((sum, col) => sum + col.minWidth, 0);
  const gapSum = GRID_COLUMN_GAP * (COMPOSER_GRID_COLUMNS.length - 1);
  return widthSum + gapSum;
}

export type LineItemLayout = "grid" | "card";

/**
 * Which line-item layout fits a MEASURED form-column width (onLayout on the
 * step-2 container — not the window width, which ignores the sidebar and
 * the live PDF side preview). The single-row grid only when the column
 * fits composerGridMinWidth(); otherwise compact per-line cards, so the
 * step never scrolls sideways (responsive-line-item-grid). Unmeasured
 * (null / 0) falls back to cards — the layout that can't overflow.
 */
export function lineItemLayoutForWidth(width: number | null): LineItemLayout {
  if (!width || width <= 0) return "card";
  return width >= composerGridMinWidth() ? "grid" : "card";
}

/** Page shell constants (app/(app) desktop layout). */
export const CONTENT_MAX_WIDTH = 1200;
/** md:px-10 — 40px on each side of the content column. */
export const PAGE_PADDING_X = 40;
/** gap-8 between the form column and the summary column. */
export const COLUMN_GAP = 32;
export const SIDEBAR_WIDTH_EXPANDED = 248;
export const SIDEBAR_WIDTH_COLLAPSED = 72;
export const SUMMARY_WIDTH = 400;

/**
 * How much horizontal room the composer's form column actually gets: the
 * page content width (capped at CONTENT_MAX_WIDTH, minus the sidebar) minus
 * its own left/right padding, minus the summary column and the gap beside
 * it when that column is rendered (summaryWidth: 0 on the items step).
 */
export function composerFormColumnWidth({
  viewportWidth,
  sidebarWidth,
  summaryWidth,
}: {
  viewportWidth: number;
  sidebarWidth: number;
  summaryWidth: number;
}): number {
  const contentWidth = Math.min(viewportWidth - sidebarWidth, CONTENT_MAX_WIDTH);
  const withoutPadding = contentWidth - PAGE_PADDING_X * 2;
  return summaryWidth > 0 ? withoutPadding - COLUMN_GAP - summaryWidth : withoutPadding;
}
