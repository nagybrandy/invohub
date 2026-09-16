# Plan — PDF pagination: no wasted pages, no content under the footer

Slice: `slice/pdf-broken-pagination-blank-page`
Backlog item: Phase 1 — "Broken pagination wastes an entire page …"
(`docs/loop-queue.md`, Phase 1, item 3)
Date: 2026-09-16 · Planner: Opus · Implementer: one Sonnet run

---

## 1. Goal and user value

An egyéni vállalkozó prints and emails these PDFs to customers and keeps
them for 8 years. Today the pagination logic is guesswork: fixed "magic
number" space reservations, a footer band that only `ensureSpace()` knows
about, and fixed-height totals rows. Measured against the current `main`
(`ac736d6`), this produces three defects that a customer sees:

**(a) Content prints straight through the footer strip.** `ensureSpace()`
reserves a 36pt footer band (`FOOTER_BAND_HEIGHT`), but the document is
created with `margin: 48`, so pdfkit's *own* auto-pagination inside
`doc.text()` breaks at `page.height - 48`, i.e. 36pt **below** where the
footer band starts. Any auto-wrapping text — `invoice.notes`, a long line
item description, a wrapped ÁFA exemption reason — flows into the band and
overprints "Köszönjük a bizalmat!" and the InvoHub lockup. Reproduced:
a 16-item invoice with a long `notes` value renders the notes text on top
of the footer strip on page 1 (rendered to PNG via `pdftoppm`).

**(b) The totals block overlaps the next block.** `drawTotalLine()` returns
`y + fontSize + 6` — a *fixed* advance — but draws the label into an 80pt
column. "Fizetendő összesen:" at the subtitle size (12pt bold) does not fit
in 80pt, so it wraps to two lines while only one line is accounted for.
Reproduced: on an ÁFA-exempt invoice the wrapped "összesen:" line sits
directly on top of the first "Alanyi adómentes …" exemption line.

**(c) Space is over-reserved, which costs whole pages.** `ensureSpace(doc,
90)` before the totals (real measured need ≈ 68pt), `ensureSpace(doc, 20 +
reasons.length * 14)` for exemption reasons (ignores wrapping), and
`ensureSpace(doc, 48)` for a notes block of arbitrary height. Reproduced:
a 24-line-item invoice pushes the entire totals + notes block onto a second,
otherwise empty page while ~77pt of usable space sits unused on page 1.
`ensureSpace()` also has no "already at the top of a fresh page" guard, so a
single oversized block can open a page and then immediately open another.

Two adjacent quality gaps that the same pass must close, because a
multi-page invoice is otherwise unreadable:

**(d) Continuation pages have no column headers.** Reproduced with a
40-line-item invoice: page 2 starts with bare rows — no
Megnevezés/Mennyiség/Egységár/ÁFA/Bruttó labels, no indication that it
belongs to the invoice on page 1.

**(e) No page indicator.** A 3-page invoice's pages are indistinguishable
once printed and separated.

Note on the item's original wording: the *symptom* it described (the default
2-item sample spilling onto a near-blank second page) is already gone — the
`pdf-invohub-brand-mark` slice removed the misplaced footer draw that caused
it, and `buildSamplePreviewInvoice()` now renders as 1 page. The queue entry
explicitly asks the next pass to "verify `ensureSpace`/`contentBottom` for
real … rather than assume the root cause is fully resolved". This slice does
that: it replaces the guesswork with measured geometry, locks the 1-page
result with a regression test so it cannot silently come back, and fixes the
three real pagination/measurement defects that remain underneath it.

**User value:** a 1–2 item invoice is always exactly one page; a genuinely
long invoice paginates like a real invoice (repeated column headers, a
"folytatás" caption, "2/3. oldal"); and no customer ever receives a PDF with
text printed over the footer.

---

## 2. Design

### 2.1 One source of truth for the bottom of the content area

The root cause of (a) is that two independent mechanisms decide where a page
ends and they disagree. Fix: make the reserved footer band part of the
document's own bottom margin, so pdfkit's internal flow and `ensureSpace()`
break at the same line by construction.

In `lib/invoices/pdf-layout.ts`:

```ts
export const PAGE_MARGIN = 48;
export const FOOTER_BAND_HEIGHT = 36;           // unchanged
/** Bottom margin the invoice document is CREATED with: the real page
 *  margin plus the reserved footer band. pdfkit's own auto-pagination
 *  inside doc.text() uses page.margins.bottom, so folding the band into
 *  the margin is what stops wrapped content from flowing into the strip. */
export const CONTENT_MARGIN_BOTTOM = PAGE_MARGIN + FOOTER_BAND_HEIGHT; // 84
export const PDF_PAGE_MARGINS = {
  top: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN,
  bottom: CONTENT_MARGIN_BOTTOM,
};

export function contentBottom(doc: Doc): number {
  return doc.page.height - CONTENT_MARGIN_BOTTOM;   // A4: 757.89
}
export function footerBandTop(doc: Doc): number {
  return contentBottom(doc);                        // identical by construction
}
export function ensureSpace(doc: Doc, neededHeight: number): void {
  // Never open a page we are already standing at the top of — that is the
  // "blank page" failure mode: a block taller than a whole content area
  // would otherwise push a page, find itself still too tall, and push
  // another.
  if (doc.y <= doc.page.margins.top + 0.5) return;
  if (doc.y + neededHeight > contentBottom(doc)) doc.addPage();
}
```

Both helpers now read the geometry constants rather than the live
`page.margins.bottom`, because the footer pass temporarily zeroes that
margin. Drop the `reserveFooter` parameter from both `contentBottom` and
`ensureSpace` (no caller passes it today).

In `generate-pdf.ts`, create the document with `margins: PDF_PAGE_MARGINS`
instead of `margin: 48`, and restore `doc.page.margins.bottom` to
`CONTENT_MARGIN_BOTTOM` after each per-page footer draw.

### 2.2 Measured totals block

Add a pure geometry helper next to `tableColumns()`:

```ts
export type TotalsColumns = { labelX; labelWidth; valueX; valueWidth };
/** Totals label/value columns, aligned with the totals rule that starts at
 *  left + pageWidth * 0.52 and ending flush with the table's Bruttó column. */
export function totalsColumns(doc: Doc, cols: TableColumns): TotalsColumns;
```

`labelX = doc.page.margins.left + pageWidth * 0.52`, `valueX = cols.totalX`,
`valueWidth = cols.totalWidth`, `labelWidth = valueX - 8 - labelX`
(≈ 159pt on A4 — "Fizetendő összesen:" fits on one line at every font
scale, which is defect (b)).

`drawTotalLine()` takes those widths and returns a **measured** advance:

```ts
const h = Math.max(
  doc.heightOfString(label, { width: labelWidth }),
  doc.heightOfString(value, { width: valueWidth })
);
return y + h + 6;
```

`generate-pdf.ts` builds the totals rows as data first
(`{ label, value, bold?, accent?, fontSize }[]`, including the conditional
`vatInHuf` row), sums their measured heights plus the 12pt lead-in and 8pt
trailer, calls `ensureSpace(doc, measuredTotalsHeight)` **once** with that
number, then draws them. The magic `90` disappears.

### 2.3 Measured exemption-reason and notes reserves

- Exemption reasons: reserve
  `reasons.reduce((s, r) => s + doc.heightOfString(r, { width: pageWidth }) + 4, 0) + 8`
  at `fonts.small`, instead of `20 + reasons.length * 14`.
- Notes: reserve the label line plus the **first ~3 lines** of the notes body
  (`labelHeight + Math.min(notesHeight, 3 * lineHeight) + 16`) so the
  "Megjegyzés:" label is never orphaned at the bottom of a page; pdfkit then
  flows the remainder correctly because of §2.1.
- Delete the `doc.y += doc.heightOfString(invoice.notes, …) + 8` line after
  the notes `doc.text()` call: pdfkit already advances `doc.y` to the end of
  the drawn (possibly paginated) text, so this double-counts. Replace with
  `doc.y += 8`.

### 2.4 Repeated table header + continuation caption

In the line-item loop, replace `ensureSpace(doc, rowHeightEstimate + 8)`
with an explicit break that also repeats the header:

```ts
const needed = rowHeightEstimate + 8;
if (doc.y > doc.page.margins.top + 0.5 && doc.y + needed > contentBottom(doc)) {
  doc.addPage();
  drawContinuationCaption();          // "<invoice number> · folytatás"
  doc.y = drawTableHeader(doc, cols, headerLabels, fonts.small, accent);
}
```

`drawContinuationCaption()` draws `${invoice.invoiceNumber || labels.draftNumber} · ${labels.continued}`
at `left`, `fonts.small`, `#666666`, and advances `doc.y` by the measured
height + 8.

### 2.5 Page indicator in the footer band

In the existing buffered-pages footer loop, when `footerRange.count > 1`,
draw `${i + 1}/${count}. oldal` (from `labels.pageIndicator`, interpolated
with `.replace("{{page}}", …).replace("{{total}}", …)` — the same idiom
`preview-html.ts` already uses for `exchangeRateValue`).

Band layout, deterministic and collision-free at A4 (`pageWidth` ≈ 499):

| footerText | count | left | centre | right |
|---|---|---|---|---|
| set | 1 | footerText (`width: pageWidth * 0.42`, ellipsis) | — | lockup |
| set | >1 | footerText (`width: pageWidth * 0.42`, ellipsis) | page indicator (`width: pageWidth * 0.16`, centred) | lockup |
| empty | 1 | — | lockup (centred) — **unchanged** | — |
| empty | >1 | page indicator (`width: pageWidth * 0.3`) | — | lockup |

The footerText clamp narrows from `pageWidth * 0.5` to `pageWidth * 0.42`;
`ellipsis: true, lineBreak: false` stay, so a long issuer footer still
truncates rather than colliding.

---

## 3. Acceptance criteria (testable, numbered)

1. `contentBottom(doc)` and `footerBandTop(doc)` both return
   `doc.page.height - (PAGE_MARGIN + FOOTER_BAND_HEIGHT)` (757.89 on A4) and
   are equal for any page geometry, including when `page.margins.bottom` has
   been temporarily zeroed for the footer draw.
2. `generateInvoicePdf` creates its document with
   `margins.bottom === CONTENT_MARGIN_BOTTOM` (84), not `margin: 48`, so
   pdfkit's own auto-pagination breaks at the top of the footer band.
3. `ensureSpace(doc, n)` does **not** call `addPage()` when
   `doc.y <= doc.page.margins.top + 0.5`, for any `n` — including `n` larger
   than a whole content area.
4. `ensureSpace(doc, n)` calls `addPage()` exactly when
   `doc.y > margins.top + 0.5 && doc.y + n > contentBottom(doc)`.
5. `totalsColumns(doc, cols)` returns `valueX + valueWidth === cols.right`,
   `labelX + labelWidth + 8 === valueX`, and `labelWidth >= 120`.
6. With real pdfkit at every `fontScale` (`small`/`medium`/`large`), the
   width of the `grossTotal` label plus `":"` in bold at the subtitle size is
   `<= totalsColumns(...).labelWidth` — i.e. "Fizetendő összesen:" never
   wraps (defect (b)).
7. `drawTotalLine` returns `y + measuredHeight + 6`, where `measuredHeight`
   is `max(heightOfString(label, labelWidth), heightOfString(value, valueWidth))`
   — proven by a stub doc whose `heightOfString` returns two line heights for
   a long label.
8. **Real-pdfkit regression, defect (a):** for each of three fixtures —
   (i) 16 line items + a ~2000-character `notes`, (ii) 40 line items,
   (iii) two ÁFA-exempt lines with a ~180-character `vatExemptionReason` —
   no `doc.text()` call issued **while `doc.page.margins.bottom !== 0`**
   (i.e. during content drawing, not the footer pass) starts below or extends
   past `footerBandTop(doc)`. Asserted by wrapping the document returned from
   `createPdfDocument` and recording each call's start `y` plus its measured
   height.
9. **Real-pdfkit regression, defect (c):** `buildSamplePreviewInvoice()`
   renders on exactly **1** page, both with and without a `company`
   (tighten the existing `BASELINE_PAGE_COUNT <= 2` assertion in
   `generate-pdf.integration.test.ts` to `=== 1`).
10. **No footer-only page:** for each fixture in AC8, every page in the
    produced document receives at least one content draw above
    `footerBandTop` — no page exists solely to carry the footer strip.
11. A 40-line-item invoice that spans ≥ 2 pages draws the table header
    (`labels.description` … `labels.gross`) once per page that carries line
    items, and draws `"<invoiceNumber> · folytatás"` once per continuation
    page (never on page 1).
12. When the buffered page count is 1, no page indicator is drawn, and the
    existing empty-`footerText` behaviour (lockup centred) is unchanged.
    When the page count is 3, the strings `1/3. oldal`, `2/3. oldal`,
    `3/3. oldal` are each drawn exactly once.
13. Every footer-band draw (issuer footerText, lockup attribution, page
    indicator) has `y >= footerBandTop(doc)` and
    `y <= page.height - PAGE_MARGIN` — the existing AC8 assertion in
    `generate-pdf.test.ts` still holds, unchanged.
14. `hu` and `en` both define `invoices.document.continued` and
    `invoices.document.pageIndicator`; the existing hu/en parity test passes.
15. `npm run test:unit` and `npx tsc --noEmit` are green; no existing test in
    `lib/invoices/**` is deleted or weakened (only the
    `BASELINE_PAGE_COUNT` bound is *tightened*, per AC9).

---

## 4. Tests to write first (TDD)

Write these **before** touching the implementation; each must fail against
current `main`.

**`lib/invoices/pdf-layout.test.ts`** (pure, stub doc — extend the existing
file, keep its current cases):
1. `contentBottom` / `footerBandTop` equality + exact value, including with a
   stub whose `margins.bottom === 0` (AC1).
2. `ensureSpace` does not add a page at `doc.y === margins.top` for
   `n = 10_000` (AC3).
3. `ensureSpace` adds a page at `doc.y = 700, n = 100` and does not at
   `doc.y = 700, n = 40` (AC4).
4. `totalsColumns` geometry invariants (AC5).
5. `drawTotalLine` measured advance with a stub `heightOfString` that returns
   24 for a long label and 12 otherwise (AC7).

**`lib/invoices/generate-pdf.test.ts`** (existing mocked-document suite —
extend `MockPDFDocument` to record the constructor options and to apply a
passed `margins` object to `this.page.margins`):
6. document is created with `margins.bottom === 84` (AC2).
7. with `mockBufferedPageRange = { start: 0, count: 3 }`, `1/3. oldal`,
   `2/3. oldal`, `3/3. oldal` are each drawn once; with `count: 1` no
   indicator is drawn (AC12).
8. hu/en `continued` + `pageIndicator` keys exist and are non-empty (AC14 —
   or fold into `lib/i18n/locales/en.test.ts` alongside the sibling cases).

**`lib/invoices/generate-pdf.integration.test.ts`** (real pdfkit — add a
small `withRecordedDoc()` helper that `jest.spyOn`s
`@/lib/invoices/pdf-document`.`createPdfDocument`, wraps `doc.text` to push
`{ startY, height, marginBottom, page }`, and returns the log):
9. AC8 — no content draw enters the footer band, for all three fixtures.
10. AC9 — `buildSamplePreviewInvoice()` is exactly 1 page, with and without a
    company (tighten `BASELINE_PAGE_COUNT`).
11. AC10 — no footer-only page, for all three fixtures.
12. AC11 — repeated table header + `folytatás` caption counts on a 40-item
    invoice.
13. AC6 — `widthOfString(grossTotal + ":")` in bold at each font scale fits
    `labelWidth`.

Keep the integration file's existing warning in mind ("deliberately the
slowest tests in this area; keep the case count small") — share one
generated document per fixture across assertions rather than regenerating.

---

## 5. Files to touch

| File | Change |
|---|---|
| `lib/invoices/pdf-layout.ts` | `PAGE_MARGIN`, `CONTENT_MARGIN_BOTTOM`, `PDF_PAGE_MARGINS`; rewrite `contentBottom` / `footerBandTop` / `ensureSpace`; add `totalsColumns`; measured `drawTotalLine` |
| `lib/invoices/generate-pdf.ts` | create doc with `PDF_PAGE_MARGINS`; measured totals / exemption / notes reserves; repeated table header + `folytatás` caption; page indicator in the buffered footer pass; restore `margins.bottom` to `CONTENT_MARGIN_BOTTOM`; drop the double-counted notes advance |
| `lib/i18n/locales/hu.ts` | `invoices.document.continued`, `invoices.document.pageIndicator` |
| `lib/i18n/locales/en.ts` | same two keys |
| `lib/invoices/pdf-layout.test.ts` | new cases 1–5 |
| `lib/invoices/generate-pdf.test.ts` | mock records/applies constructor margins; cases 6–7 |
| `lib/invoices/generate-pdf.integration.test.ts` | `withRecordedDoc()` helper; cases 9–13; tighten `BASELINE_PAGE_COUNT` |
| `lib/i18n/locales/en.test.ts` | optional home for case 8 |
| `docs/loop-queue.md` | tick the item at ship time, with the measured before/after page counts |

Do **not** touch `lib/invoices/preview-html.ts`, `pdf-brand-mark.ts`,
`pdf-fonts.ts`, `pdf-template/*`, or `db/schema.ts`.

---

## 6. i18n keys (hu + en)

Added under `invoices.document` in both locale modules (the hu/en parity test
enforces both):

| Key | hu | en |
|---|---|---|
| `invoices.document.continued` | `"folytatás"` | `"continued"` |
| `invoices.document.pageIndicator` | `"{{page}}/{{total}}. oldal"` | `"Page {{page}} of {{total}}"` |

Interpolated with `.replace("{{page}}", …).replace("{{total}}", …)`, matching
`preview-html.ts`'s existing handling of `exchangeRateValue`. Both are
document-facing vocabulary, so they are read through `documentLabels()`
(Hungarian by default regardless of the app UI language) — not through
i18next. No user-facing app-UI strings change.

---

## 7. db/schema.ts changes

**None.** No schema change of any kind — this slice is pure document
rendering. Not additive, not destructive: no `db:push`, no
`drizzle-kit generate`.

---

## 8. UX notes — mobile (375px) and desktop

No React screen changes. The affected surfaces consume the generated PDF:

- **Mobile (375px)** — `app/(app)/invoices/[id].tsx` → "PDF letöltése" and the
  emailed attachment (`lib/invoices/send-invoice-email.ts`). A phone PDF
  viewer renders A4 at ~0.45× scale, which is exactly where text printed over
  the footer strip is least legible and where a wasted second page costs a
  full swipe. Verify by opening the generated PDF full-screen; the footer
  strip must read cleanly on every page.
- **Desktop (≥768px)** — `app/(app)/settings/pdf` template preview and the
  invoice detail preview. Verify the totals block right edge stays flush with
  the table's Bruttó column and that "Fizetendő összesen:" is on one line at
  all three font scales.
- **Print** — A4 at 100%: the footer band is 36pt above a 48pt bottom margin,
  comfortably inside every consumer printer's unprintable margin.

Visual verification (the queue item's own acceptance wording): render
`buildSamplePreviewInvoice()` with and without a `company`, plus the three
AC8 fixtures, through `generateInvoicePdf`, write to the scratchpad, convert
with `pdftoppm -png -r 80`, and read the PNGs. Confirm: correct ő/ű glyphs,
the InvoHub mark visible, single-page default output, repeated column headers
on continuation pages, and no text over the footer strip.

---

## 9. Risk classification

**`none`.**

Document rendering and typography only. No `lib/tax/`, no `lib/nav/`
production behaviour, no `lib/m2m/`, no schema, no NAV endpoint of any kind,
no marketing or compliance copy. The two new i18n keys are document
vocabulary ("folytatás", a page indicator), not tax figures and not a claim
about what InvoHub does. Nothing about the invoice's *content* — mandatory
Áfa tv. 169. § fields, VAT categories, exemption reasons, amounts — changes;
only where on the page those already-computed strings land. Normal Ship-phase
auto-merge applies once typecheck + unit tests are green.

Residual risks and their mitigations:

- Changing the document's bottom margin shifts where every page breaks.
  Mitigated by AC9 (the default sample is pinned to exactly 1 page) and by
  the PNG visual check.
- `drawTotalLine`'s signature changes. Blast radius is one call site
  (`generate-pdf.ts`, 4 calls) — confirmed by grep; no other module imports
  it.
- The footer-band layout change could collide the issuer's footerText with
  the page indicator. Mitigated by the fixed width table in §2.5 and AC13.

---

## 10. Out of scope

- The **"General layout gap vs. the HTML preview"** backlog item (sparse
  content area, no card/section framing, thin line-item table). This slice
  must not restyle the document — only fix where blocks break and how much
  space they claim. Deliberately leaving the large empty area on a short
  invoice untouched.
- `lib/invoices/preview-html.ts` and the HTML preview's own layout.
- The brand mark's geometry, inks, or size (`pdf-brand-mark.ts`).
- Font embedding (`pdf-fonts.ts`) and the WinAnsi fallback path.
- Receipt/nyugta PDFs and any other document generator.
- New template options (e.g. a user-configurable footer height or a
  "repeat header" toggle) — the behaviour is unconditional.
- Playwright/E2E coverage: the auth fixture that would unblock an
  authenticated create→preview→PDF spec is its own Phase 0 backlog item.
- Any change to page **size** (A4 stays A4) or to `fontScale` values.
