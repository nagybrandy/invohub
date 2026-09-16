# Plan — PDF layout: same product/brand as the HTML preview

Slice: `slice/pdf-layout-general-improvement`
Backlog item: Phase 1 — "General layout gap vs. the HTML preview"
(`docs/loop-queue.md` line 304, 2026-09-16 owner PDF-feedback batch)
Date: 2026-09-16 · Planner: Opus · Implementer: one Sonnet run

---

## 1. Goal and user value

The PDF is the artefact the egyéni vállalkozó's customer actually receives
and the one the vállalkozó archives for 8 years. Today it does not look
like the same product as the in-app HTML preview
(`lib/invoices/preview-html.ts`), which is card-based, dense and finished:

| Section | HTML preview | PDF today (`generate-pdf.ts`) |
|---|---|---|
| Parties | two tinted "KIBOCSÁTÓ" / "VEVŐ" cards side by side | seller lines squeezed next to the logo in the header; buyer as bare text, then a **hard-coded 56pt gap** (`doc.y = billToY + 56`) |
| Meta | one compact row: kelte · határidő · **fizetési mód** · pénznem | issue/due dates stacked right in the header; **fizetési mód is never printed at all** |
| Line items | filled navy header row, white uppercase labels, per-row hairline, **6 columns incl. Nettó** | accent-coloured text on white + one rule, **5 columns, no Nettó**, no row separators |
| Totals | right block with an emphasised grand total | right block, no framing |
| ÁFA exemption note | tinted, padded note box | plain grey paragraph |
| Status | pill chip | plain grey line |

Three concrete user-visible consequences, not just aesthetics:

**(a) Missing content.** The payment method (`invoice.paymentMethod`) is on
the HTML preview and in the NAV XML, but the printed/e-mailed PDF omits it —
the customer cannot see whether to transfer or pay cash. The per-line **net**
amount is also missing, so a customer cannot check a line's net against the
net total without doing the arithmetic.

**(b) A latent overlap bug.** `doc.y = billToY + 56` is a fixed advance over
a block whose height depends on content and `fontScale`. A seller/buyer block
that renders taller than 56pt (long client name wrapping at `large` scale)
pushes the buyer text under the table header. Every other advance in this
file was converted to a measured one by the `pdf-broken-pagination-blank-page`
slice; this one was missed.

**(c) Sparse, unfinished look.** Fixed gaps plus no framing leave large empty
bands on a typical 2–4 line invoice, which reads as a placeholder next to the
preview the vállalkozó just looked at in the app.

This slice restructures the PDF body to mirror `preview-html.ts`'s section
order and framing, using pdfkit primitives (filled rounded rects, filled
table header band, hairlines) — not pixel-identical, but recognisably the
same document. It must preserve every pagination invariant won by
`2026-09-16-pdf-broken-pagination-blank-page.md`: everything new is
**measured** and reserved with `ensureSpace()` before it is drawn, and
nothing may enter the reserved footer band.

### Brand colours, honouring the configurable accent

`template.accentColor` is user-configurable, so the new framing derives from
it instead of hard-coding the preview's navy:

- `tint(accent, ratio)` — mix `accent` toward white. `tint(accent, 0.12)`
  is the party-card / totals-panel fill (≈ `#eff4fd` for the default
  `#6495ed`, i.e. the preview's `--mist`); `tint(accent, 0.24)` is the
  chip / grand-total band / ÁFA-note fill (≈ the preview's `--pale-blue`).
- `readableTextOn(hex)` — relative-luminance contrast pick, returning
  `#ffffff` on a dark fill and `#111f4a` on a light one. This is what makes
  a filled table-header band safe when a user picks a pale accent.

## 2. Acceptance criteria (testable, numbered)

**Layout primitives (`lib/invoices/pdf-layout.ts`)**

1. `tint(hex, ratio)` returns a normalised `#rrggbb` mixed toward white,
   clamps `ratio` to `[0, 1]`, and falls back to the default accent for a
   malformed input (reuse `normalizeHexColor`). `tint(c, 0)` === normalised
   `c`; `tint(c, 1)` === `#ffffff`.
2. `readableTextOn(hex)` returns `#ffffff` for `#111f4a` and `#6495ed`, and
   `#111f4a` for `#ffffff`, `#ffe680` and `tint("#6495ed", 0.24)`.
3. `tableColumns(doc)` gains a **Nettó** column (`netX`, `netWidth`), still
   computed right-to-left. At A4 with `PDF_PAGE_MARGINS` the columns never
   overlap (each column's `x + width + gap <= ` the next column's `x`) and
   `descWidth >= 150`.
4. `drawTableHeader(doc, cols, labels, fontSize, accent)` fills a band in
   `accent` behind the header row and draws **6** labels in
   `readableTextOn(accent)`; it still returns the measured y below the band,
   and a wrapped (two-line) header label still grows the band.
5. `drawTableRow(...)` draws the Nettó cell and a hairline separator
   (`#e5e9f5`) spanning `cols.left..cols.right` at the row bottom, and
   returns the same measured bottom y rule as today (max of measured
   description height and one line, + 6).
6. `drawPartyCard(doc, {x, y, width, title, lines, accent, fontSizes})`
   draws a rounded, `tint(accent, 0.12)`-filled card with an uppercase title
   and the lines inside a 10pt padding box, and returns the card's bottom y;
   `partyCardHeight(doc, ...)` returns that same height **without drawing**,
   so both cards can be drawn at equal height and the block can be reserved
   with `ensureSpace()` first.
7. `drawNoteBox(doc, {x, y, width, lines, fill, fontSize})` draws a rounded
   tinted, padded box around wrapped text and returns its measured bottom y.

**Document structure (`lib/invoices/generate-pdf.ts`)**

8. Section order matches `preview-html.ts`: header (logo/badge + company name
   left; title, number, status chip right) → party cards → meta row → line
   item table → totals → ÁFA exemption note → notes → footer band.
9. With a `company`, exactly **two** party cards are drawn side by side
   (`labels.seller` = "Kibocsátó", `labels.buyer` = "Vevő"), same top y and
   the **same height** (`max` of both measured heights), separated by a 16pt
   gutter. Without a `company`, exactly **one** card (Vevő) is drawn at
   ~half the content width (mirrors the preview's `.parties-single`).
10. The advance after the party cards is **measured**: given a company whose
    address + bank lines make the Kibocsátó card taller than the Vevő card,
    the first meta-row draw starts at `cardsBottom + 12 … cardsBottom + 24`.
    The literal `doc.y = billToY + 56` is gone from the file.
11. The meta row prints `Kiállítás kelte`, `Fizetési határidő`, `Pénznem`
    and — when `invoice.paymentMethod` is set — `Fizetési mód` with the
    localized `labels.paymentMethods[...]` value; with no payment method the
    label is not drawn and the row consumes no extra height.
12. Each line item row prints its net amount, equal to
    `formatDocumentAmount(lineItemNetTotal(item), invoice.currency)`. Totals
    values still come from `calculateInvoiceTotals` — **no arithmetic in this
    slice changes any printed amount**.
13. The totals rows are drawn on a `tint(accent, 0.12)` panel and the
    `labels.grossTotal` row on a `tint(accent, 0.24)` band with text in
    `readableTextOn` of that band; the block is still reserved by the single
    **measured** `ensureSpace(measuredTotalsHeight)` call (the panel height is
    included in that measurement).
14. ÁFA exemption reasons render inside `drawNoteBox` with a measured advance;
    nothing drawn after them overlaps them.
15. When `documentStatusChip(invoice.status)` is non-null it is drawn as a
    pill (rounded `tint(accent, 0.24)` fill + text); when it is null nothing
    is drawn and no vertical space is consumed.

**Regression / invariants (integration, real pdfkit)**

16. `buildSamplePreviewInvoice()` renders on exactly **1** page both with and
    without a `company` (existing `BASELINE_PAGE_COUNT` assertions stay).
17. The three existing fixtures (16 items + ~2000-char notes; 40 items;
    two ÁFA-exempt lines + ~180-char reason) keep passing unchanged in
    substance: no content draw enters the footer band, no page exists solely
    to carry the footer strip, the (now 6-label) table header repeats once per
    line-item page, and the `folytatás` caption appears once per continuation
    page.
18. Density guard for `buildSamplePreviewInvoice()` with a company: no
    vertical gap larger than **28pt** between the end of one drawn content
    block and the start of the next (footer band excluded) — i.e. no
    fixed-gap "holes" left in the body.
19. `npx tsc --noEmit` and `npm run test:unit` are green.

## 3. Files to touch

| File | Change |
|---|---|
| `lib/invoices/pdf-layout.ts` | add `tint`, `readableTextOn`, `drawPartyCard`, `partyCardHeight`, `drawNoteBox`; extend `tableColumns`/`drawTableHeader`/`drawTableRow` |
| `lib/invoices/generate-pdf.ts` | restructure the body per AC8–AC15; delete the fixed 56pt advance; add the meta row and the net column |
| `lib/invoices/pdf-layout.test.ts` | unit tests for AC1–AC7 |
| `lib/invoices/generate-pdf.test.ts` | mocked-doc tests for AC8–AC15 (extend the mock to record `roundedRect`/`rect`/`fill` calls) |
| `lib/invoices/generate-pdf.integration.test.ts` | AC16–AC18; update the header-label set from 5 to 6 |

Do **not** touch `preview-html.ts`, `document-labels.ts`, `pdf-fonts.ts`,
`pdf-brand-mark.ts`, `pdf-template/*` or any `app/` route.

## 4. Tests to write first (TDD order)

1. `pdf-layout.test.ts` — `tint` / `readableTextOn` value tables (AC1, AC2).
2. `pdf-layout.test.ts` — `tableColumns` 6-column non-overlap + `descWidth`
   floor (AC3); `drawTableHeader` fills a band and uses the readable text
   colour (AC4); `drawTableRow` draws the separator and the net cell (AC5).
3. `pdf-layout.test.ts` — `partyCardHeight` equals the `drawPartyCard`
   return delta, and text stays inside the padded box (AC6); `drawNoteBox`
   measured bottom (AC7).
4. `generate-pdf.test.ts` — two equal-height cards with a company / one card
   without (AC9); measured advance after the cards, and the string
   `billToY + 56` is gone (AC10); meta row with and without a payment method
   (AC11); net cell value (AC12); totals panel + grand-total band colours
   (AC13); exemption note box (AC14); status chip drawn / not drawn (AC15).
5. `generate-pdf.integration.test.ts` — page-count baselines (AC16), the
   three existing fixtures with the 6-label header set (AC17), and the
   ≤28pt-gap density guard (AC18), built on the existing `withRecordedDoc`
   recorder.

Every test is written failing first, then the smallest implementation that
makes it pass. Do not weaken an existing assertion to make a new layout fit —
if an existing pagination assertion fails, the new layout is wrong.

## 5. i18n keys (hu + en)

**No new keys are required.** Everything this slice prints already exists
under `invoices.document` in both `lib/i18n/locales/hu.ts` and `en.ts` and is
read through `documentLabels()` (Hungarian by default, independent of the UI
language):

`seller`, `buyer`, `taxNumber`, `bankAccount`, `issueDate`, `dueDate`,
`paymentMethod`, `currency`, `description`, `quantity`, `unitPrice`, **`net`**
(newly used by the PDF), `vat`, `gross`, `netTotal`, `vatTotal`, `grossTotal`,
`notes`, `draftNumber`, `footer`, `exchangeRate`, `exchangeRateValue`,
`vatInHuf`, `continued`, `pageIndicator`, plus `invoices.paymentMethods.*`
and `invoices.status.*`.

If the implementer finds a string that genuinely has no key, add it to
**both** `hu.ts` and `en.ts` under `invoices.document` — never hard-code a
Hungarian literal in `generate-pdf.ts` or `pdf-layout.ts`.

## 6. db/schema.ts changes

**None.** No schema change of any kind — not additive, not destructive. No
`drizzle-kit generate`, no `db:push`.

## 7. UX notes — mobile (375px) and desktop

This slice changes a server-generated A4 document, not a screen; no `app/` or
`components/` file is touched, so there is no new responsive surface.

- **Mobile (375px):** the PDF is reached via `PDF letöltése` on the invoice
  detail screen and via the settings PDF-template preview
  (`app/api/pdf-template+api.ts`). Both hand the buffer to the OS viewer —
  unchanged. The on-screen document preview stays the HTML one
  (`InvoiceDocumentPreview`), which already has its own ≤560px card/stacked
  layout; the point of this slice is that the downloaded PDF now *matches*
  what the user just saw there.
- **Desktop:** same; the settings template preview re-renders on accent /
  fontScale changes, so verify the new framing at all three `fontScale`
  values (`small`/`medium`/`large`) and with a non-default accent — a pale
  accent must still give readable header text (AC2/AC4).
- **Print reality check:** A4 at 48pt margins. Keep the card/meta/table stack
  above the fold for a typical 2–4 line invoice — AC16 guards the page count.

## 8. Risk classification

**`none`.** This is document rendering and typography only. It touches no
`lib/tax/`, no `lib/nav/` production behaviour, no `lib/m2m/`, no marketing
copy, no compliance claim and no tax figure — AC12 explicitly forbids
changing any computed amount, and the per-line Nettó column displays the
existing `lineItemNetTotal()` value rather than introducing a new figure.
Mandatory Áfa tv. 169. § content is unchanged (nothing is removed; the
payment method is *added*). Normal Ship-phase auto-merge applies once green.

## 9. Manual verification (from the queue item's own acceptance note)

After the tests are green, render and look at the result:

```
node -e '…generateInvoicePdf(buildSamplePreviewInvoice())…' > /tmp/…/sample.pdf   # with and without company
pdftoppm -png -r 110 /tmp/…/sample.pdf /tmp/…/sample
```

Confirm by eye: correct ő/ű glyphs throughout, the InvoHub mark in the
footer, single-page output for the default template, party cards and the
filled table header present, and a body that no longer reads as a
placeholder next to the HTML preview. Send the PNGs to the owner with
`SendUserFile`.

## 10. Out of scope

- Any change to `preview-html.ts` (the HTML preview is the reference here,
  not the thing being changed).
- New `InvoicePdfTemplate` options (card on/off, header style, logo size,
  colour presets) — the template shape stays as it is.
- The notes-only continuation-page banner (its own open queue item).
- QR codes, payment links, watermarks, logo upload/cropping.
- Any NAV XML, tax, or amount-calculation change; any marketing copy.
- E2E/Playwright work — this slice is backend document generation only.
