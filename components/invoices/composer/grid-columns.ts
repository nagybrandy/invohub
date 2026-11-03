// components/invoices/composer/grid-columns.ts
// The single source of truth for the line-item row's column widths (used by
// both the header line in StepLineItems and the cells in LineItemRow, so they
// cannot drift) and for which layout a MEASURED container gets
// (tokens.md §6.18):
//   - "row": container >= 820px — one row per item under one header line;
//     Megnevezés grows, Menny. 72, Egység 84, Egységár 112, ÁFA 112,
//     Összesen 128, delete 34.
//   - "stacked": narrower — Megnevezés full width (delete icon beside it),
//     then Menny., Egység, Egységár, ÁFA (and Összesen) on one labelled line.
// className strings are literal so NativeWind's content scan can find them.

export type LineItemLayout = "row" | "stacked";

export type ComposerGridColumn = {
  key: "description" | "quantity" | "unit" | "unitPrice" | "vat" | "total" | "actions";
  /** i18n key for the header label ("" for the delete column). */
  labelKey: string;
  /** Column width in px (the description column has none: it grows). */
  width?: number;
  /** Static classes of the column in the one-row layout. */
  className: string;
};

export const COMPOSER_GRID_COLUMNS: ComposerGridColumn[] = [
  { key: "description", labelKey: "invoices.lineItemEditor.description", className: "min-w-[200px] flex-1" },
  { key: "quantity", labelKey: "invoices.lineItemEditor.quantity", width: 72, className: "w-[72px]" },
  { key: "unit", labelKey: "invoices.lineItemEditor.unitShort", width: 84, className: "w-[84px]" },
  { key: "unitPrice", labelKey: "invoices.lineItemEditor.unitPrice", width: 112, className: "w-[112px]" },
  { key: "vat", labelKey: "invoices.fields.vat", width: 112, className: "w-[112px]" },
  { key: "total", labelKey: "invoices.lineItemEditor.amountColumn", width: 128, className: "w-[128px] items-end" },
  { key: "actions", labelKey: "", width: 34, className: "w-[34px] items-center" },
];

/** Gap between the cells of a row, in px (gap-2). */
export const GRID_COLUMN_GAP = 8;

/** Container width from which each item is a single row (the design's 820px). */
export const ROW_LAYOUT_MIN_WIDTH = 820;

/** Below this container width the line total moves to its own line and the cells shrink. */
export const COMPACT_MAX_WIDTH = 560;

/** Row layout when the measured container fits it; stacked otherwise (and while unmeasured: it cannot overflow). */
export function lineItemLayoutForWidth(width: number | null): LineItemLayout {
  if (!width || width <= 0) return "stacked";
  return width >= ROW_LAYOUT_MIN_WIDTH ? "row" : "stacked";
}

/** True for a narrow container: cells shrink and Összesen gets its own line. Unmeasured counts as narrow. */
export function isCompactWidth(width: number | null): boolean {
  if (!width || width <= 0) return true;
  return width < COMPACT_MAX_WIDTH;
}

/** Sum of the fixed columns plus the gaps between all seven — what the description column has to share. */
export function fixedColumnsWidth(): number {
  const fixed = COMPOSER_GRID_COLUMNS.reduce((sum, col) => sum + (col.width ?? 0), 0);
  return fixed + GRID_COLUMN_GAP * (COMPOSER_GRID_COLUMNS.length - 1);
}
