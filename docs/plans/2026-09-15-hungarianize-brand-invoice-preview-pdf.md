// docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md
# Plan — Hungarianize + brand the invoice document (HTML preview & PDF)

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority #2
  ("Invoice document preview/PDF is English and unbranded",
  `lib/invoices/preview-html.ts`). Same defect as the UX audit's INV-10 / B1 /
  B2, explicitly handed off by `docs/design/app-ux-spec-2026-09-14.md` §8.
- Slug: `hungarianize-brand-invoice-preview-pdf`
- Branch: `slice/hungarianize-brand-invoice-preview-pdf`
- Date: 2026-09-15
- Risk: **tax-legal** (see §7) — PR for human sign-off, **must not auto-ship**.

---

## 1. Goal and user value

This is the one artefact the EV's customer actually receives. Today it reads:

```
INV-2026-001
Status: unpaid
Bill to: Acme Kft.
Description | Qty | Unit | VAT | Total
Subtotal / VAT / Total
Issue: 2026. 06. 01. 12:00 · Due: 2026. 06. 15.
```

No issuer (kibocsátó) block at all in the HTML preview, no branding, English
labels, a raw enum (`unpaid`) printed as if it were a document field, and
`DRAFT` as the fallback title. The PDF (`lib/invoices/generate-pdf.ts`) is the
same document in the same English, plus an indigo `#4f46e5` accent that is not
the brand's cornflower, a default title `INVOICE` and the footer
`Thank you for your business.`

Since the composer redesign shipped (2026-09-15) this preview is no longer
behind a tab — it sits in the sticky summary panel on *every* invoice screen
and in the detail screen's "Előnézet". So the most-visible surface in the app
is the least Hungarian thing in it.

**What the EV gets after this slice**

1. A Hungarian bizonylat: *Számla / Díjbekérő / Előlegszámla / Sztornó számla /
   Helyesbítő számla* as the title, *Kibocsátó / Vevő / Megnevezés / Mennyiség /
   Egységár / Nettó / ÁFA / Bruttó / Fizetési határidő / Megjegyzés*.
2. Their **own** company as the issuer block (name, adószám, address, bank
   account) — which the HTML preview omits entirely today, so the preview
   currently shows a document that could not legally be issued.
3. InvoHub's visual system: navy `#111f4a` header/table head, cornflower
   `#6495ed` accent (also the new PDF default accent), pale blue `#d9e7ff` for
   the VAT-treatment note, a discreet **InvoHub wordmark in the footer**.
4. Hungarian money formatting on the document (`1 234 567 Ft`, `1 234,56 €`)
   instead of `toLocaleString(undefined)`, which on a Vercel lambda renders
   `1,234,567 Ft` to a Hungarian customer.
5. A readable mobile document: at ≤560px the line-item table collapses into
   stacked rows instead of overflowing the 375px drawer.

### Two deliberate product decisions

**(a) The InvoHub wordmark goes in the footer, not the header.** The header
identity belongs to the EV (their logo or initials badge + company name) —
that is whose invoice it is. InvoHub appears as a small navy footer wordmark
("Készült az InvoHub-bal · invohub.hu") plus the cornflower/navy system
throughout. Branding the *issuer* slot with InvoHub would be wrong on a legal
document. This is the intended reading of the backlog item's "InvoHub
wordmark".

**(b) The document stops printing internal bookkeeping state.** `Status: sent`
/ `Status: unpaid` is app state, not document content. The status chip renders
**only** for states that change what the document *is*: `draft` → "Piszkozat",
`proforma` → "Díjbekérő", `cancelled` → "Törölve", `paid` → "Fizetve". `sent`,
`unpaid`, `overdue`, `partially_paid` print nothing. The blank-number fallback
becomes "Piszkozat", not "DRAFT".

### The PDF encoding problem — verified, and why it is handled this way

`pdfkit` with the standard Helvetica AFM writes WinAnsi (cp1252). Verified
empirically against the repo's own pdfkit: `ő` (U+0151) and `ű` (U+0171) are
emitted as raw two-byte codes (`<0151>`, `<0171>`), which a viewer reads as two
wrong glyphs. **This already corrupts user data today** — a partner named
"Kőfaragó Kft." or a line "Tetőfelújítás" is garbage in every PDF the app has
ever emailed. No embeddable font exists in the repo (`assets/fonts/` has one
monospace TTF and two woff2 files pdfkit cannot read; `node_modules` has no
TTF/OTF at all), so embedding a proper Latin-Extended-A font is its own item
(new queue entry, §8).

Interim behaviour in this slice: `toWinAnsiSafe()` maps `ő→ö`, `ű→ü` (plus
uppercase) on **every string drawn into the PDF**, labels and user data alike.
"Vevö" and "Köfaragó" are mildly wrong but legible; today's output is not. The
HTML preview is UTF-8 and is **never** transliterated — it shows the correct
text. The helper carries a TODO pointing at the font item, and a test pins it
so it is removed, not forgotten.

---

## 2. Acceptance criteria (testable, numbered)

**Label module (`lib/invoices/document-labels.ts`)**

1. `documentLabels()` with no argument returns the Hungarian label set; the
   outgoing document does **not** follow the app's UI language (an EN-UI user
   still issues a Hungarian bizonylat). `documentLabels("en")` returns the
   English set.
2. Every label the module exposes is read from `lib/i18n/locales/hu.ts` /
   `en.ts` (`invoices.document.*`, `invoices.documentTypes.*`,
   `invoices.status.*`) — no string is duplicated inline in the module, and
   `lib/i18n/locales/en.test.ts`'s existing parity test therefore covers it.
3. `formatDocumentAmount(1234567, "HUF") === "1 234 567 Ft"` (narrow no-break
   space U+00A0 between groups and before "Ft") and
   `formatDocumentAmount(1234.5, "EUR") === "1 234,56 €"` — explicit `hu-HU`,
   independent of the server's default locale.
4. `toWinAnsiSafe("Vevő űrlap ŐSZ ŰR")` === `"Vevö ürlap ÖSZ ÜR"`; every other
   character is unchanged; `isWinAnsiSafe("Fordított adózás")` is `true`.

**HTML preview (`lib/invoices/preview-html.ts`)**

5. `generateInvoicePreviewHtml(makeInvoice())` contains none of `"Bill to"`,
   `"Description"`, `"Qty"`, `"Status:"`, `"Subtotal"`, `"DRAFT"`.
6. It contains `Számla`, `Kibocsátó`, `Vevő`, `Megnevezés`, `Mennyiség`,
   `Egységár`, `Nettó`, `ÁFA`, `Bruttó`, `Fizetési határidő`, plus
   `<meta charset="utf-8">` and `lang="hu"`.
7. Document title follows `documentType`: `proforma` → `Díjbekérő`, `storno` →
   `Sztornó számla`, `modify` → `Helyesbítő számla` (from
   `invoices.documentTypes.*`).
8. Status chip: `status: "draft"` renders "Piszkozat"; `status: "paid"` renders
   "Fizetve"; `status: "sent"` and `status: "unpaid"` render **no** status chip
   (assert the absence of "Kiküldve"/"Fizetetlen").
9. `invoiceNumber: ""` renders "Piszkozat" as the document number, never
   "DRAFT".
10. With `{ company: { name: "Kovács Bt.", taxNumber: "11111111-1-11",
    address: "Fő u. 1.", city: "Budapest", bankAccount: "12345678-…" } }` the
    output contains all four values under the `Kibocsátó` heading; with no
    `company` the issuer block is omitted and the rest of the document still
    renders (no `undefined`/`null` in the HTML).
11. Per-line the table prints net and VAT amount, not just a gross total: for
    `makeLineItem({ quantity: 2, unitPrice: 100, vatRate: 27 })` the row
    contains the net `200`, the VAT `54` and the gross `254` amounts as
    formatted by `formatDocumentAmount`.
12. Brand: the output contains `#111f4a`, `#6495ed` and the footer wordmark
    `InvoHub`; it contains a `@media (max-width: 560px)` block and a
    `@media print` block.
13. Escaping is preserved: `clientName: "<script>alert(1)</script>"` yields no
    `<script>` and does yield `&lt;script&gt;` (existing test, must keep
    passing); the same holds for the company name and line descriptions.
14. The existing VAT-treatment tests still pass unchanged: `AAM` prints the
    category short label and `Alanyi adómentes` once; `FAD` prints
    `Fordított adózás`; an ordinary taxed invoice prints neither.

**PDF (`lib/invoices/generate-pdf.ts`, `pdf-template/defaults.ts`)**

15. With the mocked pdfkit document, `mockDrawnTexts` contains `Kibocsátó`,
    `Vevő`, `Megnevezés`, `Mennyiség`, `Egységár`, `ÁFA`, `Bruttó`,
    `Fizetési határidő` and none of `Bill to`, `Description`, `Qty`,
    `Subtotal`, `Status: sent`.
16. Every string in `mockDrawnTexts` satisfies `isWinAnsiSafe` — including for
    an invoice whose client name is `"Kőfaragó Kft."` and whose line
    description is `"Tetőfelújítás"` (they are drawn as `Köfaragó Kft.` /
    `Tetöfelújítás`). This is the guard that fails the day someone adds a `ő`
    label without the embedded font.
17. `DEFAULT_PDF_TEMPLATE` is `titleText: "SZÁMLA"`, `accentColor: "#6495ed"`,
    `notesLabel: "Megjegyzés"`, `footerText: "Köszönjük a bizalmat!"`;
    `mergePdfTemplate({})` and `normalizeHexColor("nope")` follow the new
    defaults, and `pdf-template/service.test.ts` / `defaults.test.ts` /
    `invoice-pdf.test.ts` / `__tests__/screens/app-pages.smoke.test.tsx` are
    updated for them.
18. Amounts drawn into the PDF use `formatDocumentAmount` (same Hungarian
    grouping as the HTML), asserted on one row total.

**Wiring**

19. `GET /api/invoices/[id]/preview` passes the user's company and PDF
    template into `generateInvoicePreviewHtml` (via the existing
    `buildInvoicePdfContext`), so the saved-invoice preview shows the issuer
    block and the user's accent colour.
20. `InvoiceDocumentPreview` accepts an optional `company` prop and uses it for
    the unsaved-draft path; `ComposerSummary`/`InvoiceComposer` pass the
    company the composer hook already loads. Rendering without it must not
    crash or fetch anything new (test: draft preview with no company still
    renders an iframe).
21. `InvoiceDocumentPreview`'s own chrome is translated: no literal
    `"Document preview"`, `"Open PDF in browser"`, `"HTML preview is available
    on web."`, `"PDF preview is available on web…"`, `"Failed to load HTML
    preview."`, `"Failed to load PDF preview."` remains in the file; each comes
    from an `invoices.preview.*` key present in both locales.

**Regression**

22. `npx tsc --noEmit` clean and `npm run test:unit` green, including
    `lib/i18n/locales/en.test.ts`'s hu/en key-parity test.

---

## 3. Tests to write first (TDD — write, watch fail, then implement)

1. `lib/invoices/document-labels.test.ts` (new) — AC 1–4: default locale is
   `hu`, `en` set resolves, labels come from the locale objects (assert one
   label equals `hu.invoices.document.buyer`), `formatDocumentAmount` for
   HUF/EUR, `toWinAnsiSafe`/`isWinAnsiSafe`.
2. `lib/invoices/preview-html.test.ts` (extend; keep every existing case) —
   AC 5–14. Replace the two cases that assert English (`Issue: …` and
   `DRAFT`) with their Hungarian counterparts.
3. `lib/invoices/generate-pdf.test.ts` (extend) — AC 15, 16, 18. The existing
   mock already captures `mockDrawnTexts`; add the `Kőfaragó`/`Tetőfelújítás`
   fixture case for the WinAnsi guard.
4. `lib/invoices/pdf-template/defaults.test.ts` (extend) — AC 17.
5. `components/invoices/InvoiceDocumentPreview.test.tsx` (extend) — AC 20, 21:
   renders with and without `company`; chrome strings resolve through `t`.
6. `lib/i18n/locales/en.test.ts` (extend) — assert
   `locale.invoices.document.buyer` and `locale.invoices.preview.title` are
   truthy in both locales (the parity test covers the rest automatically).

---

## 4. Files to touch

| File | Change |
|---|---|
| `lib/invoices/document-labels.ts` | **new** — `documentLabels(locale = "hu")` reading `invoices.document.*` / `invoices.documentTypes.*` / `invoices.status.*` straight from the locale objects (plain data modules, safe to import server-side — do **not** pull in `lib/i18n/index.ts`/i18next), `formatDocumentAmount`, `isWinAnsiSafe`, `toWinAnsiSafe`, `documentTitleFor(documentType)`, `documentStatusChip(status)` (returns `null` for the non-printing statuses) |
| `lib/invoices/document-labels.test.ts` | **new** |
| `lib/invoices/preview-html.ts` | rewrite: `generateInvoicePreviewHtml(invoice, options?: { company?: InvoicePdfCompany; template?: InvoicePdfTemplate; locale?: DocumentLocale })`, branded HU layout, `escapeHtml` also escaping `'` |
| `lib/invoices/preview-html.test.ts` | extend/replace English assertions |
| `lib/invoices/generate-pdf.ts` | labels + amounts from the module; wrap every `doc.text(...)` string through `toWinAnsiSafe` (do it in one place — a local `draw(text, …)` helper — not at 20 call sites) |
| `lib/invoices/generate-pdf.test.ts` | extend |
| `lib/invoices/pdf-template/defaults.ts` | HU defaults + cornflower accent |
| `lib/invoices/pdf-template/defaults.test.ts` | extend |
| `lib/invoices/pdf-template/sample-invoice.ts` | Hungarian sample (`Tanácsadás`, `Projektmenedzsment`, `Minta Ügyfél Kft.`, HUF) so `/settings/pdf`'s sample preview is Hungarian too |
| `lib/invoices/pdf-template/service.test.ts`, `lib/invoices/invoice-pdf.test.ts`, `__tests__/screens/app-pages.smoke.test.tsx` | update fixtures asserting the old English defaults |
| `app/api/invoices/[id]/preview+api.ts` | build company + template via `buildInvoicePdfContext` and pass them in |
| `components/invoices/InvoiceDocumentPreview.tsx` | optional `company` prop; all chrome through `t()` |
| `components/invoices/InvoiceDocumentPreview.test.tsx` | extend |
| `components/invoices/composer/useInvoiceComposer.ts` | expose the already-loaded `company` in the hook's return |
| `components/invoices/composer/ComposerSummary.tsx`, `composer/InvoiceComposer.tsx` | pass `company` down to the preview |
| `app/(app)/settings/pdf.tsx` | placeholders `INVOICE` → `SZÁMLA`, `Thank you for your business.` → the new HU footer default (placeholder text only — the screen's own redesign is a separate item) |
| `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts` | new keys (§5) |
| `lib/i18n/locales/en.test.ts` | extend |
| `docs/loop-queue.md` | item marked `[~]`, new PDF-font item filed |

---

## 5. i18n keys (hu + en)

New namespace `invoices.document.*` — **document** vocabulary, printed on the
bizonylat. Every value must stay WinAnsi-safe until the font item lands
(AC 16 enforces it for anything reaching the PDF).

| Key | hu | en |
|---|---|---|
| `invoices.document.seller` | Kibocsátó | Issuer |
| `invoices.document.buyer` | Vevő | Bill to |
| `invoices.document.taxNumber` | Adószám | Tax number |
| `invoices.document.bankAccount` | Bankszámlaszám | Bank account |
| `invoices.document.issueDate` | Kiállítás kelte | Issue date |
| `invoices.document.dueDate` | Fizetési határidő | Due date |
| `invoices.document.paymentMethod` | Fizetési mód | Payment method |
| `invoices.document.currency` | Pénznem | Currency |
| `invoices.document.description` | Megnevezés | Description |
| `invoices.document.quantity` | Mennyiség | Quantity |
| `invoices.document.unitPrice` | Egységár | Unit price |
| `invoices.document.net` | Nettó | Net |
| `invoices.document.vat` | ÁFA | VAT |
| `invoices.document.vatAmount` | ÁFA összeg | VAT amount |
| `invoices.document.gross` | Bruttó | Gross |
| `invoices.document.netTotal` | Nettó összesen | Net total |
| `invoices.document.vatTotal` | ÁFA összesen | VAT total |
| `invoices.document.grossTotal` | Fizetendő összesen | Total due |
| `invoices.document.notes` | Megjegyzés | Notes |
| `invoices.document.draftNumber` | Piszkozat | Draft |
| `invoices.document.footer` | Készült az InvoHub-bal · invohub.hu | Made with InvoHub · invohub.hu |

Preview-chrome keys (app UI, not the document):

| Key | hu | en |
|---|---|---|
| `invoices.preview.title` | Dokumentum előnézet | Document preview |
| `invoices.preview.openPdf` | PDF megnyitása | Open PDF |
| `invoices.preview.openPdfInBrowser` | PDF megnyitása böngészőben | Open PDF in browser |
| `invoices.preview.htmlWebOnly` | Az előnézet weben érhető el. | HTML preview is available on web. |
| `invoices.preview.pdfWebOnly` | A PDF előnézet weben érhető el. Ha nem töltődik be, nyisd meg böngészőben. | PDF preview is available on web. Open it in your browser if the embed does not load. |
| `invoices.preview.htmlLoadFailed` | Az előnézet betöltése sikertelen. | Failed to load HTML preview. |
| `invoices.preview.pdfLoadFailed` | A PDF betöltése sikertelen. | Failed to load PDF preview. |

Also add the key the detail screen already calls with a `defaultValue`:
`invoices.detail.previewTitle` = `Előnézet` / `Preview`.

Reused, not re-added: `invoices.documentTypes.*`, `invoices.status.*`,
`invoices.paymentMethods.*`, and the VAT reason text from
`lib/invoices/vat.ts` (unchanged — do **not** retype any exemption wording).

---

## 6. db/schema.ts changes

**None.** Neither ADDITIVE nor DESTRUCTIVE — no column, table, index or
enum is added or altered, no `drizzle-kit generate`, nothing for `db:push`.
Everything needed (company profile, PDF template, invoice fields) already
exists and is already loaded by `buildInvoicePdfContext`.

---

## 7. UX notes — mobile (375px) and desktop

**Document layout (both surfaces).** `max-width: 800px`, white page on a
neutral ground, 32px page padding. Header: issuer identity left (company logo
if `logoUrl`, else a cornflower initials badge + navy company name), document
title + number + optional status chip right-aligned in navy. Below: two
mist-background (`#edf2fa`) party cards — `Kibocsátó` / `Vevő`. Then a meta
row (Kiállítás kelte · Fizetési határidő · Fizetési mód · Pénznem), the line
table (navy `#111f4a` header row, white text, `tabular-nums`, right-aligned
figures), a right-aligned totals block with `Fizetendő összesen` in navy at
`1.25rem`, the pale-blue (`#d9e7ff`) VAT-treatment note when present,
`Megjegyzés`, and a footer separated by a 1px navy-20% rule carrying the
InvoHub wordmark.

**Mobile (375px).** The preview renders inside a full-width drawer, so the
document CSS carries `@media (max-width: 560px)`: the two party cards stack,
page padding drops to 16px, and the line table switches to stacked rows —
each row a bordered block with `Megnevezés` on its own line and
`Mennyiség / Egységár / Nettó / ÁFA / Bruttó` as label-value pairs (CSS
`::before` from `data-label`). **No horizontal scrolling inside the document
at 375px** — this is the thing the desktop-first table would otherwise break.

**Desktop.** The composer's sticky summary panel renders the same HTML at
`scale(0.42)` inside a 400px column; at that scale the navy table head and the
cornflower accent are what make it readable as "an invoice" at a glance — so
keep the header band and table head solid-filled rather than hairline-ruled.
The detail screen's `layout="single"` preview keeps its 520px iframe height and
its "Download PDF" button (unchanged).

**Print.** `@media print` drops the page background and shadow and sets
`@page { margin: 12mm }`, so the browser-printed preview matches the PDF.

---

## 8. Risk classification

**`tax-legal`.**

Reason: this rewrites the outgoing bizonylat — the document the Hungarian
customer receives and the one Áfa tv. 169. § governs. It renames every
mandatory-content field into Hungarian, decides which document title each
`documentType` prints, changes what the document does and does not state
about its own status, and changes the default template text on every new
user's invoices. `.claude/skills/hu-invoicing-rules/SKILL.md` marks the exact
required wording **ellenőrizendő**, so the Hungarian labels chosen here are a
compliance judgement an agent cannot sign off. The WinAnsi transliteration
(`ő→ö`) on the PDF additionally alters a partner's legal name in the emitted
document — legible where today it is garbage, but still a change a human must
accept knowingly.

Per `CLAUDE.md`, Ship must **not** auto-merge this: open a PR for human
sign-off. The PR description must call out, explicitly, (a) the label set for
tax review, (b) the status-printing rule from §1(b), and (c) the
transliteration interim.

No `lib/tax/**`, no `lib/nav/**`, no `lib/m2m/**` and no marketing copy is
touched; no tax figure is introduced; the NAV XML is untouched; no new network
call is added.

---

## 9. Out of scope

- **PDF font embedding.** The real fix for `ő`/`ű` — embed a Latin-Extended-A
  TTF (regular + bold) and stop transliterating. Needs a font binary, a
  licence decision, `assets/pdfkit-data` + `scripts/prepare-server-pdf-deps.mjs`
  + `vercel.json` `includeFiles` + `scripts/verify-pdf-vendor.mjs` changes.
  **Filed as a new Phase 1 queue item by this slice.**
- `exchangeRate` / the HUF VAT base on the document and in the NAV XML — owner
  priority #3, tax-gated, its own slice. The document shows the invoice
  currency only.
- Payment method / payment date into the NAV XML — separate tax-gated item.
- Per-VAT-rate totals breakdown (`groupVatRows` exists in the composer) on the
  document — worth doing, but it is a compliance decision of its own; totals
  stay net / VAT / gross here.
- `Teljesítés dátuma` on the document — `fulfillmentDate` is still only
  composed into `notes`, not a first-class `Invoice` field; adding it is a
  schema + NAV change.
- The `/settings/pdf` screen itself (B3 switch-vs-button, B4 "Small/Medium/
  Large", missing live split preview) — separate item; this slice only fixes
  its two English placeholders.
- E-mail template Hungarianization (T1–T4) and `NotificationPanel` chrome
  i18n — their own queue items.
- The storno/helyesbítő PDF printing the generic `template.titleText` instead
  of its own document-type title — the HTML preview fixes this (AC 7); the PDF
  title stays user-configurable and is left alone here.
- Any E2E spec for the preview — blocked on the Phase 0 authenticated-test-user
  item.
