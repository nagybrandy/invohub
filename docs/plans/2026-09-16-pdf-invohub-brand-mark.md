// docs/plans/2026-09-16-pdf-invohub-brand-mark.md
# Plan — Put the real InvoHub mark in the invoice PDF footer strip

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority note
  (2026-09-16, "a pdf sokkal rosszabbul néz ki mint a html számla, javítsd,
  és legyen ott a rendes invohubos logó"), **item 2 of 3** in the PDF-quality
  list: *"No real InvoHub brand mark anywhere in the PDF"*.
- Slug: `pdf-invohub-brand-mark`
- Branch: `slice/pdf-invohub-brand-mark` (created by the Build phase in its
  own worktree — not by Research/Planning, which commits on `main`).
- Date: 2026-09-16
- Risk: **none** (see §8). Document branding/typography only — no NAV, tax,
  schema or compliance-claim surface. Normal Ship-phase auto-merge applies
  once green.

---

## 1. Goal and user value

The invoice PDF is the one artefact an egyéni vállalkozó actually hands to a
client, an accountant or NAV. Today it carries **no InvoHub identity at all**:

- `generate-pdf.ts` draws either the issuer's own `company.logoUrl` or, when
  that is unset (the default for a brand-new EV who has not uploaded a logo),
  a plain coloured initials square from `drawLogoBadge` — that square is the
  *issuer's* initials, not InvoHub.
- The only footer the PDF prints is `template.footerText` — the user's own
  message, default `"Köszönjük a bizalmat!"`.
- The HTML preview (`preview-html.ts`) *does* print an attribution line,
  `labels.footer` = `"Készült az InvoHub-bal · invohub.hu"`, but no mark.

So the two renderings of the same document disagree again (same class of
defect as the ő/ű slice), and the product that produced the invoice is
invisible on it. Every Hungarian invoicing product the owner competes with
puts a discreet "készült a … -val" strip on the document; it is also the
cheapest distribution channel this product has — every invoice is seen by at
least one other business.

**After this slice**, both renderings end with the same branding strip: a
hairline rule, the issuer's own footer message, and the actual InvoHub mark
(the chosen `rounded` direction, duotone navy + cornflower) next to
`"Készült az InvoHub-bal · invohub.hu"`. In the PDF the strip repeats on
every page and is drawn from the **shared geometry**
(`components/marketing/brand-mark-geometry.ts`'s `BRAND_MARK_GEOMETRY[
BRAND_MARK_DEFAULT]`), so if the brand direction is ever switched at that
single constant, the invoice follows — nothing is retyped.

### Value to the EV specifically

- Their invoice stops looking like an unfinished template and starts looking
  like a product's output — the owner's literal complaint.
- Their own footer message survives and gets a proper place (left), instead
  of being the only thing in the footer, floating centred and — today —
  mis-positioned (see §3, note on `contentBottom(doc, 0) + 8`).
- On a 2+ page invoice the footer now appears on every page, not only on
  whichever page happened to be current when generation ended.

---

## 2. Approach (and one deliberate deviation from the item's wording)

The backlog item says "rendered as a small vector/raster asset pdfkit can
draw". **Do not ship a raster or an on-disk SVG asset.** Verified locally
against this repo's pdfkit 0.19.1: pdfkit's own SVG-path parser draws every
command the mark uses (`M H V A L Z`, plus `doc.circle`), with stroke width,
round caps and round joins, under a `translate`+`scale` transform — the mark
renders cleanly from **~18pt upward** at any resolution.

Drawing the geometry natively is strictly better than an asset here:

- No new runtime asset to resolve, and therefore **no change to
  `scripts/prepare-server-pdf-deps.mjs` / `verify-pdf-vendor.mjs`** — none of
  the Vercel-bundling fragility that the embedded-font slice had to defend
  against with a build-time verifier.
- It is vector, so it stays sharp at any zoom and adds ~1 KB, not ~30 KB.
- It reads `BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT]` at runtime, which is
  exactly the "do not just retype the brand colors" intent, taken further:
  nothing about the mark is retyped, not the paths and not the inks
  (`landingColors.navy` / `landingColors.cornflower` from
  `components/marketing/landing-theme.ts`).

Both `brand-mark-geometry.ts` and `landing-theme.ts` are dependency-free
constant modules (no React, no `react-native-svg`), so importing them from
`lib/invoices/` is safe in the server bundle and in tests.

### Footer band placement

`generate-pdf.ts` currently draws the footer at
`contentBottom(doc, 0) + 8` = `page.height - margins.bottom + 8` — i.e. **8pt
below the bottom margin**, which is outside the printable box and is the
likely trigger for pdfkit's auto page break (this is very probably the cause
of backlog item 3's near-blank second page). This slice replaces that call
with a correct footer pass; see §9 for how to handle the overlap with item 3.

The replacement is pdfkit's standard buffered-pages idiom — `bufferPages:
true` is **already** set on the document, so no constructor change is needed:

```
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i += 1) {
  doc.switchToPage(i);
  const saved = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;   // per page — each page owns its margins
  …draw the strip…
  doc.page.margins.bottom = saved;
}
doc.flushPages();
```

Verified locally: this draws into the reserved band on every page and does
**not** add a page (a 2-page document stays 2 pages).

The band itself is pinned to the reserve that `ensureSpace`/`contentBottom`
already assume (`reserveFooter = 36`), so content and footer cannot collide
by construction:

```
FOOTER_BAND_HEIGHT = 36
footerBandTop(doc) === contentBottom(doc)        // the invariant, asserted in a test
```

### Strip layout (A4, 48pt margins, `fontScale: "medium"`)

```
 ├────────────────────────────────────────────────────────────────┤  hairline #e5e7eb at footerBandTop
 │ Köszönjük a bizalmat!                 [◆] Készült az InvoHub-  │  issuer footer left (grey #666666)
 │                                           bal · invohub.hu     │  lockup right (mark 18pt + #8a90a6)
 └────────────────────────────────────────────────────────────────┘  bottom margin (blank)
```

- Issuer `template.footerText` on the **left**, clipped to the left half
  (`width: pageWidth * 0.5`, single line — `lineBreak: false`, `ellipsis:
  true`) so a long custom footer can never push into the lockup.
- InvoHub lockup **right-aligned** to the content right edge: mark at 18pt,
  6pt gutter, then `labels.footer` at `fonts.small`, vertically centred on
  the mark.
- When `template.footerText` is empty, the lockup is **centred** instead —
  matching the HTML preview's centred footer.
- The strip is deliberately subordinate: grey text, small mark, below a
  separator rule. It must never read as the issuer of the document (§8).

### HTML preview parity

`preview-html.ts`'s `.footer` div gains the same mark, inline, from the same
geometry — via a new tiny string serializer
`components/marketing/brand-mark-svg.ts` (`brandMarkSvg({ size, ink, accent
})` → an `<svg viewBox="0 0 48 48">…</svg>` string). This is what makes the
two documents actually match, which is the owner's underlying complaint.

---

## 3. Acceptance criteria (numbered, testable)

**PDF**

1. `generateInvoicePdf` draws the InvoHub attribution text — exactly
   `documentLabels().footer` (`"Készült az InvoHub-bal · invohub.hu"`) — in
   the footer band. The string is read from `documentLabels()`, never
   hard-coded in `generate-pdf.ts`.
2. `generateInvoicePdf` draws the InvoHub mark next to that text, using every
   shape of `BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT]` (both `frame` and
   `flow` groups), at 18pt.
3. Frame shapes are drawn in `landingColors.navy`, flow shapes in
   `landingColors.cornflower`. No `#111f4a` / `#6495ed` string literal appears
   anywhere in `lib/invoices/pdf-brand-mark.ts` or in the new footer code.
4. A shape with a `stroke` weight is stroked at that `lineWidth` and is
   **never** `fill()`ed; a shape without one is filled and never stroked.
   Round line cap and join are set when the geometry's `rounded` is true, and
   a per-shape `cap` overrides it.
5. `drawBrandMark` leaves the document's graphics state clean: `save()`/
   `restore()` are balanced, and `fillColor`/`strokeColor` are reset
   afterwards so the next drawn element is not tinted (same discipline as
   `drawLogoBadge`).
6. The issuer's own `template.footerText` is still drawn, in the same band,
   and is not dropped or overlapped by the lockup.
7. The footer strip is drawn on **every** page: with a buffered page range of
   2 pages, both the attribution text and the mark geometry are drawn twice.
8. Nothing in the footer pass is drawn below the bottom margin — every footer
   draw's `y` satisfies `y <= page.height - page.margins.bottom`.
9. `footerBandTop(doc) === contentBottom(doc)` (with the default reserve), so
   the band the footer occupies is exactly the band content already avoids.
10. Real-pdfkit integration: `generateInvoicePdf(buildSamplePreviewInvoice())`
    still returns a `%PDF` buffer with `FontFile2`, does not throw on the
    mark's arc (`A`) path commands, and the rendered page count is unchanged
    or lower than before this slice (never higher).

**HTML preview**

11. `generateInvoicePreviewHtml` renders an inline `<svg …viewBox="0 0 48 48"`
    brand mark inside the `.footer` element, containing the geometry's path
    `d` strings (asserted against the imported constant, not a literal), next
    to the existing `labels.footer` text.
12. The inline SVG is marked decorative-but-named for assistive tech
    (`role="img"` + `aria-label="InvoHub"`) and the footer stays on one line
    at desktop width and wraps without overflow inside the existing
    `@media (max-width: 560px)` block.

**Shared**

13. `brandMarkSvg()` and `drawBrandMark()` both read
    `BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT]`; a test asserts the shapes used
    are deep-equal to that imported constant, so switching
    `BRAND_MARK_DEFAULT` to `"angular"` changes both renderings with no other
    edit.
14. `npx tsc --noEmit` and `npm run test:unit` are green.

---

## 4. Tests to write first (TDD order)

Write these before touching the implementation; each should fail for the
right reason first.

1. **`lib/invoices/pdf-brand-mark.test.ts`** (new) — fake recording doc
   (`path`, `circle`, `translate`, `scale`, `save`, `restore`, `lineWidth`,
   `lineCap`, `lineJoin`, `fill`, `stroke`, `fillColor`, `strokeColor`):
   - AC2/AC13: every `d` / circle of `BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT]`
     `.frame` and `.flow` is issued, compared against the imported constant.
   - AC3: frame ink = `landingColors.navy`, flow ink = `landingColors.cornflower`.
   - AC4: stroked shape → `lineWidth(6.5)` + `stroke()`, never `fill()`;
     filled shape → `fill()`, never `stroke()`; `lineCap("round")` set.
   - AC5: `save`/`restore` counts match; colors reset after the call.
   - Scale/translate: `translate(x, y)` then `scale(size / BRAND_MARK_VIEWBOX)`.
2. **`lib/invoices/pdf-layout.test.ts`** (extend) — AC9: `footerBandTop(doc)`
   equals `contentBottom(doc)` for a stub page, and `FOOTER_BAND_HEIGHT` is
   the same 36 the existing `reserveFooter` default uses.
3. **`lib/invoices/generate-pdf.test.ts`** (extend) — the existing
   `MockPDFDocument` needs new no-op/recording methods: `path`, `circle`,
   `translate`, `scale`, `lineCap`, `lineJoin`, `bufferedPageRange`,
   `switchToPage`, `flushPages`. Record `(text, x, y)` triples so y can be
   asserted.
   - AC1: `mockDrawnTexts` contains `documentLabels().footer`.
   - AC6: it also still contains `DEFAULT_PDF_TEMPLATE.footerText`.
   - AC7: with `bufferedPageRange()` stubbed to `{ start: 0, count: 2 }`, the
     attribution text is drawn twice and `switchToPage` is called for 0 and 1.
   - AC8: every recorded footer-band draw has `y <= height - margins.bottom`.
   - AC3 (negative): the generate-pdf source path draws mark colors via the
     brand module — assert the recorded fill colors are
     `landingColors.navy` / `landingColors.cornflower` rather than
     string-matching the file.
4. **`lib/invoices/generate-pdf.integration.test.ts`** (extend, real pdfkit) —
   AC10: `buildSamplePreviewInvoice()` with and **without** a `company` both
   produce a `%PDF` buffer containing `FontFile2`, with no throw. Keep this to
   the two cases; it is the slowest test here.
5. **`components/marketing/brand-mark-svg.test.ts`** (new) — AC11/AC13:
   `brandMarkSvg()` output contains the geometry's path `d` strings and circle
   coordinates from the imported constant, the two inks, `viewBox="0 0 48 48"`,
   `role="img"`, `aria-label="InvoHub"`; stroked shapes get
   `stroke-width`/`fill="none"` and filled shapes get `fill` with no stroke.
6. **`lib/invoices/preview-html.test.ts`** (extend) — AC11/AC12: the `.footer`
   markup contains both the inline `<svg` mark and `labels.footer`; the
   existing "carries the InvoHub brand" test keeps passing.

Manual verification before marking done (same method as the ő/ű slice):
render `buildSamplePreviewInvoice()` through `generateInvoicePdf` **with and
without** a `company`, `pdftoppm -png -r 150`, and confirm by eye that the
mark is crisp at 18pt, the strip sits above the bottom margin, the issuer
footer and the lockup do not collide, and the page count did not increase.

---

## 5. Files to touch

**New**

- `lib/invoices/pdf-brand-mark.ts` — `BRAND_MARK_PDF_SIZE = 18`,
  `drawBrandMark(doc, { x, y, size, ink, accent })`,
  `brandMarkWidth(size)` (= `size`, square), and
  `drawBrandLockup(doc, { x, y, text, font, fontSize, size, align })`
  returning the drawn width so the caller can right-align it.
- `lib/invoices/pdf-brand-mark.test.ts`
- `components/marketing/brand-mark-svg.ts` — `brandMarkSvg({ size, ink,
  accent, variant? })` string serializer (pure; no React, no
  `react-native-svg`, so `preview-html.ts` can call it server-side).
- `components/marketing/brand-mark-svg.test.ts`

**Changed**

- `lib/invoices/pdf-layout.ts` — export `FOOTER_BAND_HEIGHT` and
  `footerBandTop(doc)`; make `contentBottom`'s default reserve reference the
  same constant instead of a second literal `36`.
- `lib/invoices/pdf-layout.test.ts`
- `lib/invoices/generate-pdf.ts` — delete the
  `if (template.footerText) { … contentBottom(doc, 0) + 8 … }` block; add a
  `drawFooterStrip(doc, …)` buffered-pages pass immediately before
  `doc.end()`, using `docFonts` and `labels.footer`.
- `lib/invoices/generate-pdf.test.ts`
- `lib/invoices/generate-pdf.integration.test.ts`
- `lib/invoices/preview-html.ts` — footer div becomes mark + text; small CSS
  addition to `.footer` (flex, centred, 6px gap, `svg { flex-shrink: 0 }`).
- `lib/invoices/preview-html.test.ts`
- `docs/loop-queue.md` — tick the item with the implementation summary.

**Explicitly NOT touched**

- `scripts/prepare-server-pdf-deps.mjs`, `scripts/verify-pdf-vendor.mjs` — no
  new runtime asset (§2).
- `db/schema.ts`, `drizzle/**` — no schema change.
- `lib/invoices/pdf-template/*` — no new template field (§7).
- `assets/brand/**`, `marketing/**` — the geometry module stays the source of
  truth; nothing is regenerated.

---

## 6. i18n keys (hu + en)

**No new keys are required.** The strip reuses the key that already backs the
HTML footer, in both locales:

| Key | hu | en |
|---|---|---|
| `invoices.document.footer` | `Készült az InvoHub-bal · invohub.hu` | `Made with InvoHub · invohub.hu` |

Reached through `documentLabels(locale).footer` — which, per
`document-labels.ts`, defaults to **Hungarian regardless of the app UI
language**, because the outgoing bizonylat is a Hungarian document. Keep that
behaviour: do not thread the UI locale into the footer.

`"InvoHub"` itself (the SVG `aria-label`) is a product name, not translatable
copy, so it is a literal — not an i18n key.

---

## 7. db/schema.ts changes

**None.** No new column, table or index. Not additive, not destructive —
nothing at all. `db:push` must not run for this slice.

A "hide the InvoHub attribution" white-label toggle would need a template
column and is explicitly out of scope (§9).

---

## 8. Risk classification

**Risk: `none`.**

Reason: this slice changes only how the invoice document is *drawn*. It does
not touch `lib/tax/**`, `lib/nav/**`, `lib/m2m/**`, any tax figure, any NAV
environment or credential, the NAV XML builder, or any marketing claim about
compliance or "replacing the accountant". No database schema change, no new
network call, no new runtime asset, no user input rendered in a new place.

Guardrails to keep it at `none` — the implementer must hold these:

- The strip is **additive branding only**. It must not move, resize, cover,
  displace or reword any Áfa tv. 169. § mandatory field (issuer, buyer, tax
  numbers, dates, line items, VAT breakdown, totals, exemption reason,
  invoice number). AC8 + AC9 are what mechanically enforce this: the strip
  lives in the band content already reserves.
- The mark must stay visually subordinate (grey text, 18pt mark, below a
  separator) so no reader can mistake InvoHub for the *issuer* of the
  invoice. The issuer's identity block at the top of the page is unchanged.
- The attribution wording is the existing, already-shipped locale string. Do
  not invent new marketing copy here — new product claims in a document that
  goes to NAV would change the risk class.

---

## 9. Out of scope

- **Backlog item 3, "Broken pagination wastes an entire page."** Replacing the
  `contentBottom(doc, 0) + 8` footer call may well make the near-blank second
  page disappear as a side effect. If it does, **do not tick item 3** —
  instead note the observation under item 3 in `docs/loop-queue.md` so the
  next slice verifies `ensureSpace`/`contentBottom` properly rather than
  assuming the root cause was only the footer.
- **Backlog item 4, "General layout gap vs. the HTML preview"** — card/section
  framing, table styling, totals block. Not this slice.
- **The HTML preview does not render `template.footerText` at all** (it only
  renders `labels.footer`), so a user's custom footer set in
  `settings/pdf` is invisible in the preview but visible in the PDF. That is a
  real parity bug, but it belongs to item 4 — file it there, do not fix it
  here.
- Page numbering ("1 / 2") in the footer band.
- A white-label / "hide InvoHub attribution" template toggle (needs a schema
  column and a pricing decision).
- Putting the mark in the PDF *header* or using it as the fallback for a
  missing `company.logoUrl` — the header badge stays the **issuer's**
  initials; InvoHub belongs in the footer only (§8).
- Receipt (nyugta) and e-mail templates, the marketing site, app icons, and
  regenerating `assets/brand/*.svg`.
- Switching `BRAND_MARK_DEFAULT` — the `rounded` direction stays chosen.
