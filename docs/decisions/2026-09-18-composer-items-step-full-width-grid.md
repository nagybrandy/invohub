# 2026-09-18 — Items step spans the full content width, no sticky summary

## Context

`docs/design/app-ux-spec-2026-09-14.md` §2.2 specifies a desktop composer
layout of "a jobb oszlop mindig látszik" ("the right column [ComposerSummary]
is always visible") across all three steps: form column capped at 720px,
sticky 400px `ComposerSummary` beside it.

The 2026-09-15 ux-desktop audit found that on step 2 (Tételek) this leaves
the line-item grid only ~680px of the ~1112px the form column actually gets
at 1440px (`1440 - sidebar(248) - padding(80) - gap(32) - summary(400)`),
against a genuine minimum row width of 860px (6 columns —
`components/invoices/composer/grid-columns.ts`). The row scrolls
horizontally *inside its own card*: a user has to scroll sideways to reach
the ÁFA column while typing a description. On a compliance-critical field
(AAM vs. 27% on the wrong line is a NAV Áfa tv. 169.§ problem, not a
cosmetic one), that's a real risk, not just an inconvenience.

## Decision

On the items step only, `composerDesktopLayout("items")` returns
`{ showSummaryColumn: false, formMaxWidth: undefined }` — no 400px
`ComposerSummary` column, no 720px form cap. The grid gets the full content
column (1112px at 1440px with the sidebar expanded), comfortably above its
860px minimum. Partner and Ellenőrzés (`composerDesktopLayout("partner"
| "review")`) are unchanged: `{ showSummaryColumn: true, formMaxWidth: 720 }`,
matching spec §2.2 exactly.

This is a deliberate, scoped deviation from spec §2.2 for one step, not a
rewrite of the spec — see
`components/invoices/composer/composer-line-item-horizontal-scroll-1440`
plan (`docs/plans/2026-09-18-composer-line-item-horizontal-scroll-1440.md`)
for the full width arithmetic.

## Why INV-9 and INV-13 still hold

- **INV-9** ("the full preview opens in a drawer, it never replaces the
  form"): the preview button + drawer logic was extracted verbatim into
  `ComposerPreviewButton.tsx`. `ComposerSummary` renders it with
  `showThumbnail` (unchanged behaviour on Partner/Ellenőrzés);
  `StepLineItems` renders the same component — just the button, no
  thumbnail — inside its own sticky totals bar via a `previewSlot` prop.
  The preview is one click away on every step, drawer-only, same as before.
- **INV-13** ("Nettó összesen + one row per ÁFA kulcs + Bruttó összesen is
  always visible, never collapsed to two numbers"): `StepLineItems`' own
  totals block (already below the grid on every step) keeps exactly this
  content and gains `md:sticky md:bottom-0` plus an opaque background, so
  it stays on screen while scrolling the grid — a strictly better
  visibility guarantee than before, not a weaker one. `ComposerSummary`'s
  own Nettó/ÁFA/Bruttó block is simply not rendered on this step (it was
  always redundant with the grid's own totals block — see the plan's
  goal section) — no case existed where a user could see numbers on step 2
  without this same breakdown.

## Consequences

- Step 2 no longer shows a live shrunk document-preview thumbnail (that
  only ever lived in `ComposerSummary`, not duplicated in `StepLineItems`).
  The full preview remains one click away via the same button.
- Below ~1188px viewport width the grid still scrolls horizontally inside
  its own card (`md:overflow-x-auto` stays) — accepted for this slice, not
  silently dropped; see the plan's "Out of scope" section.
- `docs/design/app-ux-spec-2026-09-14.md` itself is intentionally **not**
  rewritten — this ADR is the record of the deviation, per the plan.
