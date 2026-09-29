# Plan — composer line-item row fits at 1440px without inner scrolling

Slug: `composer-line-item-horizontal-scroll-1440`
Branch (created later by the Build phase): `slice/composer-line-item-horizontal-scroll-1440`
Phase: 1 — Core invoicing, NAV-compliant
Queue item: "Composer line-item row still needs horizontal scrolling within
itself at 1440px…" (2026-09-15 audit, ux-desktop)

## Goal and user value

An egyéni vállalkozó writes invoices on a laptop. Today step 2 (Tételek) of
the composer renders an 8-column grid whose minimum width (~1068px, and the
wrapper hardcodes `md:min-w-[1040px]`) does not fit the ~680px the form
column actually gets at 1440px beside the fixed 400px `ComposerSummary`. The
row therefore scrolls horizontally *inside its own card*: the user types a
description, then has to scroll the grid sideways to see the ÁFA column and
the line total, and scroll back to edit the next line. On a compliance-
critical screen (AAM vs. 27% on the wrong line is a NAV problem, not a
cosmetic one) the ÁFA column must never be off-screen while typing.

The fix is the redesign the audit asked for, in two moves:

1. **Step 2 gets the full content width.** The 400px summary column is worth
   its space on Partner and Ellenőrzés, but during item entry it costs more
   than it gives: its live Nettó/ÁFA/Bruttó block is already duplicated by
   the totals block under the grid, and its 0.42-scaled document preview is
   unreadable anyway. On the items step the grid spans the content column and
   the totals move into a **sticky totals bar** under the grid, with the
   "Teljes előnézet" button beside them — so live totals and the preview stay
   one glance / one click away (INV-9 holds: the preview still never replaces
   the form).
2. **The row loses two redundant columns.** `Menny.` + `Egység` become one
   cell (a number field with the unit selector attached — they are one
   thought: "2 óra"), and per-line `Nettó` + `Bruttó` become one right-aligned
   `Összesen` cell showing bruttó bold with nettó muted underneath. Nothing is
   hidden: both figures still render, per line and in the totals.

Result (arithmetic verified, see AC1): row minimum 860px vs. 1112px available
at 1440px with the sidebar expanded — the full row fits, and the ~250px of
slack goes to the description field, which is the field Hungarian service
lines actually need ("Könyvelési tanácsadás 2026. augusztus havi díja").

### Width model (the numbers the ACs assert)

| | width |
|---|---|
| Megnevezés | `flex-1`, min **240** |
| Menny. / Egység | **132** |
| Egységár | **132** |
| ÁFA | **132** (spec §2.4 says 132; code has 160) |
| Összesen (bruttó + nettó) | **140** |
| ⋯ (törlés) | **44** |
| 5 × 8px gap | **40** |
| **row minimum** | **860** |

Available form-column width = `min(viewport − sidebar, 1200) − 80` (page
`max-w-[1200px]`, `md:px-10`), minus `32 + summaryWidth` when the summary
column is rendered. Sidebar: 248 expanded / 72 collapsed
(`components/navigation/AppSidebar.tsx`).

| viewport | sidebar | items step (no summary) | fits 860? | old (summary 400) |
|---|---|---|---|---|
| 1440 | 248 | 1112 | yes | 680 — scrolls |
| 1440 | 72 | 1120 | yes | 688 — scrolls |
| 1280 | 248 | 952 | yes | 520 |
| 1188 | 248 | 860 | exactly | 428 |
| 1024 | 248 | 696 | no → `overflow-x-auto` fallback stays |

Below ~1188px the grid still scrolls inside its card; that is accepted and
documented, not silently ignored (see Out of scope).

## Acceptance criteria

1. `composerGridMinWidth()` (new, `components/invoices/composer/grid-columns.ts`)
   returns **860** — the sum of the 6 column widths above plus 5 × 8px gaps —
   and `COMPOSER_GRID_COLUMNS` has exactly 6 entries with unique keys, the
   first being `description` with `minWidth: 240` and `flex: true`.
2. `composerFormColumnWidth({ viewportWidth: 1440, sidebarWidth: 248, summaryWidth: 0 })`
   returns **1112** and is `>= composerGridMinWidth()`; the same call with
   `summaryWidth: 400` returns **680** and is `< composerGridMinWidth()` (the
   regression this slice fixes, pinned as a test so it cannot come back).
3. `composerDesktopLayout("items")` (new, `composer-logic.ts`) returns
   `{ showSummaryColumn: false, formMaxWidth: undefined }`;
   `composerDesktopLayout("partner")` and `composerDesktopLayout("review")`
   both return `{ showSummaryColumn: true, formMaxWidth: 720 }`.
4. `InvoiceComposer` renders `ComposerSummary` (testID `composer-summary`) in
   the desktop right column only when `composerDesktopLayout(step).showSummaryColumn`
   is true, and applies `formMaxWidth` to the form column — i.e. no hardcoded
   `step !== "items"` check survives in the JSX.
5. `StepLineItems` renders one desktop header cell per `COMPOSER_GRID_COLUMNS`
   entry (6 cells, labels via `t(col.labelKey)`), and the grid wrapper's
   minimum width comes from `composerGridMinWidth()` — the hardcoded
   `md:min-w-[1040px]` is gone.
6. `LineItemRow`'s desktop branch renders exactly 6 cells whose widths come
   from the same `COMPOSER_GRID_COLUMNS` table (header and row cannot drift).
7. The merged quantity/unit cell renders the quantity `InputField` and a unit
   control whose `accessibilityLabel` is `t("invoices.fields.unit")`; picking a
   unit from the menu still calls `onChange({ unit })` (INV-6 coverage
   preserved through the merge).
8. For a line `quantity 1 · unitPrice 450000 · vatRate 27 · HUF`, the merged
   amount cell renders **both** `571 500` (bruttó, `font-semibold`) and
   `450 000` (nettó, muted, prefixed with `t("invoices.lineItemEditor.netAbbrev")`).
   No per-line figure that exists today disappears.
9. The totals block under the grid keeps its current content (Nettó összesen,
   one row per ÁFA kulcs via `groupVatRows`, Bruttó összesen — INV-13) and
   gains `md:sticky md:bottom-0` plus an opaque background, and renders the
   `previewSlot` node it is handed.
10. `StepLineItems` accepts a `previewSlot?: React.ReactNode` prop;
    `InvoiceComposer` passes `<ComposerPreviewButton …/>` into it, so the
    "Teljes előnézet" drawer is reachable from step 2 without the summary
    column. `ComposerSummary` renders the same extracted component, and its
    existing test (INV-9: the preview opens in a drawer, it does not replace
    the form) still passes unchanged in intent.
11. Mobile (< 768px / `md:hidden`) output of `LineItemRow` is byte-for-byte
    unchanged: card header with `lineLabel`, full-width description, 2×2 field
    grid, `lineTotal` line, 44px delete target.
12. No interactive control in the desktop row has a smaller effective tap
    target than today: the unit control and the delete control keep `h-9` plus
    `hitSlop={8}` (≥ 44px effective), inputs keep the grid's `h-9`.
13. Every new user-facing string is a translation key present in **both**
    `lib/i18n/locales/hu.ts` and `en.ts`; `npm run test:unit` covers no
    hardcoded literal in the touched components.
14. `npx tsc --noEmit` and `npm run test:unit` are green.

## Tests to write first (TDD order)

1. `components/invoices/composer/grid-columns.test.ts` (new) — AC1, AC2.
   Pure arithmetic, no render. Write this first; it is the whole point of the
   slice expressed as a number.
2. `components/invoices/composer/composer-logic.test.ts` (extend) — AC3.
3. `components/invoices/composer/LineItemRow.test.tsx` (new) — AC6, AC7, AC8,
   AC11, AC12. Follow `StepLineItems.test.tsx` conventions: `react-test-renderer`,
   `@/__tests__/mocks/gluestack-ui` for hstack/vstack/pressable/text/input,
   stub `VatCategoryPicker` and `@/lib/ui/confirm`, `t = (k) => k`.
4. `components/invoices/composer/StepLineItems.test.tsx` (extend + adjust) —
   AC5, AC9, AC10. The existing "shows the Egység (unit) column header (INV-6)"
   test asserts the literal key `invoices.fields.unit` in the header; it moves
   to the merged header key `invoices.lineItemEditor.quantityUnit`, and the
   INV-6 intent is re-asserted at row level by test 3 / AC7. Keep the existing
   INV-13, live-recompute, catalogue and one-row-per-item tests passing.
5. `components/invoices/composer/ComposerSummary.test.tsx` (adjust only if the
   extraction forces a mock change) — AC10.
6. AC4 is asserted through AC3's pure function plus a read of the JSX; do not
   add a full desktop `InvoiceComposer` render test (the only existing full
   render, `__tests__/screens/app-pages.smoke.test.tsx`, mocks
   `useIsDesktop: () => false`, and a desktop variant would need the whole
   drawer/preview/product graph mocked for little value).

## Files to touch

New:
- `components/invoices/composer/grid-columns.ts` — `COMPOSER_GRID_COLUMNS`,
  `GRID_COLUMN_GAP = 8`, `composerGridMinWidth()`,
  `composerFormColumnWidth({ viewportWidth, sidebarWidth, summaryWidth })`,
  and the layout constants (`CONTENT_MAX_WIDTH = 1200`, `PAGE_PADDING_X = 40`,
  `COLUMN_GAP = 32`, `SIDEBAR_WIDTH_EXPANDED = 248`, `SIDEBAR_WIDTH_COLLAPSED = 72`,
  `SUMMARY_WIDTH = 400`).
- `components/invoices/composer/grid-columns.test.ts`
- `components/invoices/composer/LineItemRow.test.tsx`
- `components/invoices/composer/ComposerPreviewButton.tsx` — the "Teljes
  előnézet" button + drawer + scaled `InvoiceDocumentPreview`, lifted verbatim
  out of `ComposerSummary` (props: `invoice`, `invoiceId?`, `company?`,
  `showThumbnail?`, `t`).
- `docs/decisions/2026-09-18-composer-items-step-full-width-grid.md` — ADR
  recording the deliberate deviation from spec §2.2's "a jobb oszlop mindig
  látszik" on step 2, and why INV-9/INV-13 still hold.

Changed:
- `components/invoices/composer/LineItemRow.tsx` — desktop branch only: merge
  qty+unit, merge nettó+bruttó, take widths from `COMPOSER_GRID_COLUMNS`.
- `components/invoices/composer/StepLineItems.tsx` — header from the shared
  table, `style={{ minWidth: composerGridMinWidth() }}` instead of
  `md:min-w-[1040px]`, sticky totals bar, `previewSlot`.
- `components/invoices/composer/ComposerSummary.tsx` — use `ComposerPreviewButton`.
- `components/invoices/composer/composer-logic.ts` — `composerDesktopLayout()`.
- `components/invoices/composer/InvoiceComposer.tsx` — consume
  `composerDesktopLayout(step)`; pass `previewSlot` to `StepLineItems`; update
  the file-header comment (it currently states "sticky 400px summary" for all
  steps).
- `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts`.
- `docs/loop-queue.md` — tick the item on ship.

Do **not** touch: `lib/invoices/calculations.ts`, `lib/nav/**`,
`lib/invoices/generate-pdf.ts`, `db/schema.ts`, any API route.

## i18n keys (hu + en)

| key | hu | en |
|---|---|---|
| `invoices.lineItemEditor.quantityUnit` | `Menny. / Egység` | `Qty / unit` |
| `invoices.lineItemEditor.amountColumn` | `Összesen` | `Total` |
| `invoices.lineItemEditor.netAbbrev` | `nettó` | `net` |

Reused, unchanged: `invoices.fields.unit` (now the unit control's
`accessibilityLabel`), `invoices.lineItemEditor.description`,
`.unitPrice`, `.deleteAction`, `invoices.vat.categoryLabel`,
`invoices.totals.netTotal`, `invoices.totals.grossTotal`,
`invoices.composer.vatRowLabel`, `invoices.composer.openFullPreview`.
Removed from the header table (still used elsewhere — leave the keys in place):
`invoices.lineItemEditor.quantity` stays in use by the mobile card.

Avoid `ő`/`ű` nowhere required — these strings are UI only, not PDF text, so
the PDF WinAnsi constraint does not apply here.

## db/schema.ts changes

**None.** No schema change, additive or otherwise. This slice is presentation
only; `InvoiceLineItem` keeps its current shape and no persisted value moves.

## UX notes

**Desktop (≥ 768px `md`, tuned for 1440px):**
- Step 2 spans the content column; Partner and Ellenőrzés keep the 720px form
  cap and the 400px sticky summary exactly as today.
- Column order is unchanged left-to-right: Megnevezés · Menny./Egység ·
  Egységár · ÁFA · Összesen · ⋯. Numbers stay right-aligned and `tabular-nums`
  (spec §4.6).
- Merged qty/unit cell: quantity `InputField` (`flex-1`, decimal-pad) with the
  unit `Pressable` (`w-[52px]`, shows `db ▾`) beside it inside the 132px cell;
  the unit menu keeps its current absolute dropdown and `z-10`.
- Merged amount cell: `571 500 Ft` on line 1 (`font-semibold`), `nettó 450 000 Ft`
  on line 2 (`size="xs"`, `text-muted-foreground`). Right-aligned.
- Sticky totals bar: `md:sticky md:bottom-0 bg-background border-t border-subtle`,
  totals right-aligned as today, `previewSlot` (the Teljes előnézet button)
  left-aligned on the same row.
- Below ~1188px the grid keeps `md:overflow-x-auto` — the row simply no longer
  needs it at the width the audit measured.

**Mobile (375px):** unchanged. `LineItemRow`'s `md:hidden` card, the 48px
sticky totals bar and the single-row footer in `InvoiceComposer` are untouched;
AC11 pins that. Re-check at 375px after the change only to confirm nothing
leaked across the `md:` boundary.

**Styling rule:** all of this is `className` (NativeWind). The single `style`
object allowed here is `style={{ minWidth: composerGridMinWidth() }}` — a plain
object, never an array (AGENTS.md §1).

## Risk classification

**none.**

- No `lib/tax/**`, no tax figure, no marketing/compliance copy.
- No `lib/nav/**` or `lib/m2m/**` change; no NAV endpoint is called; NAV mode
  handling untouched.
- No `db/schema.ts` change, no migration, no `db:push`.
- Compliance-adjacent but safe: the ÁFA column and both per-line figures stay
  visible (AC8), and making the ÁFA column reachable without sideways scrolling
  *reduces* the chance of an AAM/27% mis-entry. Invoice totals, NAV XML and the
  PDF are computed elsewhere and are not touched.

Ship path: normal auto-ship if typecheck + unit tests are green and no
confirmed high/medium finding remains.

## Out of scope

- The < 1188px desktop range: the grid still scrolls inside its card there.
  Accepted for this slice; file a follow-up only if an audit measures it.
- Any mobile layout change.
- Gross-price ("bruttóból visszafelé") line entry — a real EV need, but a
  separate calculation-level feature, not a layout slice.
- Redesigning `ComposerSummary` itself (width, the 0.42-scale thumbnail) for
  the Partner/Ellenőrzés steps.
- User-resizable or persisted column widths.
- Rewriting `docs/design/app-ux-spec-2026-09-14.md`; the deviation is recorded
  as an ADR instead.
- Playwright e2e for the composer — still blocked on the Phase 0 "Auth E2E test
  user/fixture" queue item.
