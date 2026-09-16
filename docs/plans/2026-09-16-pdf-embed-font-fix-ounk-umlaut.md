// docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md
# Plan — Embed a Latin-Extended-A font in the invoice PDF (ő/ű render correctly)

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority
  (2026-09-16, "a pdf sokkal rosszabbul néz ki mint a html számla"), first
  sub-item: **"Hungarian ő/ű render as ö/ü in the PDF"**.
- Slug: `pdf-embed-font-fix-ounk-umlaut`
- Branch: `slice/pdf-embed-font-fix-ounk-umlaut` (created by the Build phase
  in its own worktree — not by Research/Planning).
- Date: 2026-09-16
- Risk: **none** (see §7). Document rendering/typography only; normal
  Ship-phase auto-merge applies once green.

---

## 1. Goal and user value

Today every invoice PDF InvoHub produces is misspelled Hungarian. Because
pdfkit's built-in Helvetica is a WinAnsi (cp1252) AFM font with no glyph for
U+0151 (ő) / U+0171 (ű), `lib/invoices/generate-pdf.ts` patches `doc.text` to
push **every** drawn string through `toWinAnsiSafe()`, which substitutes
ő→ö and ű→ü. The EV's customer receives a legal bizonylat that says

```
Vevö · Fizetési határidö · Megnevezés: Tetöfelújítás · Köfaragó Kft.
```

This is the one artefact the EV hands to a client, an accountant, or NAV in
an audit. Their own company name, their client's name and their line-item
descriptions are being silently rewritten. The HTML preview (`preview-html.ts`)
shows the correct text, so the PDF and the preview literally disagree — which
is exactly what the owner noticed.

**After this slice:** the PDF embeds a real Latin-Extended-A TrueType font
(Noto Sans Regular + Bold, SIL OFL 1.1) and draws Hungarian exactly as typed —
in the header, the issuer/vevő blocks, the line-item table, the totals, the
ÁFA exemption note, the notes block and the footer. The text also becomes
selectable/searchable and copy-pastes correctly out of a PDF viewer, which
matters when an accountant or NAV reads the document. The transliteration
stays only as a loud, last-resort fallback so a bundling regression degrades
to "legible but imperfect" instead of "PDF endpoint 500s".

### Key finding from the research pass (do not skip)

pdfkit resolves `doc.font(name)` against `_registeredFonts` **first**, so it
is tempting to register the TTFs under the names `"Helvetica"` /
`"Helvetica-Bold"` and leave all existing call sites untouched. **This
silently does not work.** Verified locally with this repo's pdfkit 0.19.1:

| registered as | `doc._font` after `doc.font(name)` | `pdftotext` output |
|---|---|---|
| `InvoHubSans` | `EmbeddedFont` (subset) | `Tetőfelújítás Kőfaragó Kft. ŰRLAP` |
| `Helvetica` | `StandardFont` | `Tet\`elújítás K\`aragó Kft. $Ä#3Bg@` |

A registration under a base-14 name falls back to the standard WinAnsi font
and produces garbage. So the fonts **must** use non-standard names and every
`doc.font("Helvetica…")` call site must be updated (§4, §5).

Also verified locally: Noto Sans has glyphs for ő ű Ő Ű á € ; it is ~4–5 %
wider than Helvetica at the same size, and all five line-item header labels
still fit their current column widths at every `fontScale` (worst case
`Mennyiség` = 54.4pt in a 60pt column at size 10), so no layout rework is
needed here.

---

## 2. Acceptance criteria (testable, numbered)

1. `assets/fonts/pdf/NotoSans-Regular.ttf` and
   `assets/fonts/pdf/NotoSans-Bold.ttf` are committed, together with the
   upstream `OFL.txt` licence and a short `README.md` recording provenance
   (package/version the files came from) — no font file without its licence.
2. `lib/invoices/pdf-fonts.ts` exposes `registerDocumentFonts(doc)` which
   registers both TTFs on a pdfkit document and returns
   `{ embedded: true, regular, bold }`, or `{ embedded: false, regular:
   "Helvetica", bold: "Helvetica-Bold" }` when the files cannot be resolved.
3. The registered font names are **not** base-14 PDF names (not
   `Helvetica*`, `Courier*`, `Times*`, `Symbol`, `ZapfDingbats`), and after
   `doc.font(regular)` / `doc.font(bold)` on a real pdfkit document the
   active font is an `EmbeddedFont`, not a `StandardFont`. (Locks in the §1
   finding.)
4. With fonts embedded, `generateInvoicePdf` draws Hungarian text
   unmodified: a client named `Kőfaragó Kft.`, a line item
   `Tetőfelújítás`, and the labels `Vevő` / `Fizetési határidő` reach
   `doc.text` with their original ő/ű.
5. `generateInvoicePdf` no longer wraps `doc.text` with `toWinAnsiSafe` on
   the embedded path; the wrapper is installed **only** on the fallback
   path.
6. On the fallback path (font files unresolvable) the old transliteration
   behaviour is unchanged **and** a single explicit `console.error` names the
   degradation (path + "falling back to ő→ö / ű→ü transliteration"). The PDF
   still renders; it never throws and never silently degrades.
7. Every `doc.font(...)` call in `lib/invoices/generate-pdf.ts` and
   `lib/invoices/pdf-layout.ts` uses the resolved names (no hard-coded
   `"Helvetica"` / `"Helvetica-Bold"` string left in either file outside
   `pdf-fonts.ts`'s fallback constants) — asserted by a test that records
   the font names the document was asked for.
8. A real-pdfkit integration test generates a PDF for
   `buildSamplePreviewInvoice()` and asserts the buffer starts with `%PDF`
   and contains `FontFile2` (i.e. a font is actually embedded, not merely
   referenced).
9. The five line-item header labels (`Megnevezés`, `Mennyiség`, `Egységár`,
   `ÁFA`, `Bruttó`) each measure ≤ their column width in the embedded bold
   font at every `fontScale` (small/medium/large) — no new header wrapping.
10. `scripts/prepare-server-pdf-deps.mjs` copies the TTFs into
    `dist/server/assets/pdf-fonts/` (same pattern as `assets/pdfkit-data`)
    and exits non-zero if the source fonts are missing.
11. `scripts/verify-pdf-vendor.mjs` fails the build unless the vendored
    runtime can register the bundled TTF under a non-standard name, draw
    `Árvíztűrő tükörfúrógép` with it, and produce a `%PDF` buffer containing
    `FontFile2`. (This is what makes a Vercel bundling regression a failed
    deploy instead of a silently wrong invoice.)
12. `npm run typecheck` and `npm run test:unit` are green.
13. Manual visual check recorded in the PR/commit body: render
    `buildSamplePreviewInvoice()` through `generateInvoicePdf` (with and
    without a `company`), `pdftoppm -png` it, and confirm ő/ű are correct
    throughout; `pdftotext` of the same PDF round-trips the Hungarian text.

---

## 3. Font choice, provenance and licensing

**Noto Sans static Regular + Bold**, SIL Open Font License 1.1 (embedding and
redistribution allowed; the licence file must ship with the fonts).

Neither of the two TTFs currently in `assets/fonts/` works: `SpaceMono-Regular.ttf`
is a monospace display face, and the Ranade brand files are `.woff2`
(a format pdfkit/fontkit embedding should not be relied on here). So new files
are added.

Acquire the exact static instances (verified during planning — 629 KB / 631 KB,
non-variable, with the glyphs we need):

```bash
# from the repo root, into a temp dir
curl -sL "$(npm view @expo-google-fonts/noto-sans dist.tarball)" -o /tmp/noto.tgz
tar xzf /tmp/noto.tgz -C /tmp \
  package/400Regular/NotoSans_400Regular.ttf \
  package/700Bold/NotoSans_700Bold.ttf \
  package/LICENSE_FONT
mkdir -p assets/fonts/pdf
cp /tmp/package/400Regular/NotoSans_400Regular.ttf assets/fonts/pdf/NotoSans-Regular.ttf
cp /tmp/package/700Bold/NotoSans_700Bold.ttf       assets/fonts/pdf/NotoSans-Bold.ttf
cp /tmp/package/LICENSE_FONT                       assets/fonts/pdf/OFL.txt
```

Do **not** add `@expo-google-fonts/noto-sans` as a runtime dependency — the
server needs the bytes inside the deployed lambda, and the committed-asset
pattern is what `assets/pdfkit-data` already proves works on Vercel. Verify
after copying that each file is a real TTF (`file assets/fonts/pdf/*.ttf`
→ TrueType, ~630 KB each), not an LFS pointer or a `.png` preview.

If that tarball is unavailable, any OFL/Apache static TTF with full
Latin-Extended-A (Noto Sans, Inter, Open Sans, DejaVu Sans) is acceptable —
keep the licence file and record what was used in `assets/fonts/pdf/README.md`.
Sanity-check coverage before committing:

```js
const fk = require("fontkit");
const f = fk.openSync("assets/fonts/pdf/NotoSans-Regular.ttf");
["ő","ű","Ő","Ű","á","é","í","ó","ö","ú","ü","€"].every((c) => f.hasGlyphForCodePoint(c.codePointAt(0)));
```

---

## 4. Files to touch

**New**

- `assets/fonts/pdf/NotoSans-Regular.ttf`, `assets/fonts/pdf/NotoSans-Bold.ttf`,
  `assets/fonts/pdf/OFL.txt`, `assets/fonts/pdf/README.md` (provenance).
- `lib/invoices/pdf-fonts.ts` — resolution + registration + name lookup:

  ```ts
  export const PDF_FONT_REGULAR = "InvoHubSans";      // NOT a base-14 name — see plan §1
  export const PDF_FONT_BOLD = "InvoHubSans-Bold";
  export const FALLBACK_FONT_REGULAR = "Helvetica";
  export const FALLBACK_FONT_BOLD = "Helvetica-Bold";

  export type DocumentFonts = { regular: string; bold: string; embedded: boolean };

  export function resolvePdfFontFiles(): { regular: string; bold: string } | null;
  export function registerDocumentFonts(doc: PDFDocumentInstance): DocumentFonts;
  export function documentFontNames(doc: PDFDocumentInstance): { regular: string; bold: string };
  ```

  `resolvePdfFontFiles()` searches, per root from `pdf-document.ts`'s
  `collectSearchRoots()`: `dist/server/assets/pdf-fonts`, `assets/fonts/pdf`
  (both files must exist in the same dir). Result cached in a module-level
  variable like `pdfkitDataDir` already is.
  `documentFontNames(doc)` reads pdfkit's `_registeredFonts` (typed via a
  narrow local cast) and returns the embedded names when `PDF_FONT_REGULAR`
  is registered on **that** document, else the Helvetica fallback — so the
  layout helpers need no new parameters and stay correct under concurrent
  requests (no module-level "current font" state).
- `lib/invoices/pdf-fonts.test.ts` — see §5.
- `lib/invoices/generate-pdf.integration.test.ts` — real pdfkit, AC8.

**Changed**

- `lib/invoices/pdf-document.ts` — export `collectSearchRoots()` (currently
  module-private) so `pdf-fonts.ts` reuses the exact same bundle-lookup
  strategy. No behaviour change.
- `lib/invoices/generate-pdf.ts` — call `registerDocumentFonts(doc)` right
  after `createPdfDocument(...)`; install the `toWinAnsiSafe` `doc.text`
  patch **only** when `!embedded` (plus the one-time `console.error`);
  replace the 7 hard-coded `doc.font("Helvetica…")` calls with the resolved
  names; rewrite the stale file-header comment and drop the
  `TODO(needs-human-review, PDF font item)`.
- `lib/invoices/pdf-layout.ts` — 5 hard-coded font names
  (`drawLogoBadge`, `drawTextBlock`, `drawTableHeader`, `drawTableRow`,
  `drawTotalLine`) become `documentFontNames(doc)` lookups.
- `lib/invoices/document-labels.ts` — keep `toWinAnsiSafe` / `isWinAnsiSafe`
  and their tests, but retitle the comment block: it is now the *fallback*
  path, not the normal one; remove the TODO that asks for this slice.
- `lib/invoices/generate-pdf.test.ts` — the `MockPDFDocument` gains
  `registerFont()` + `_registeredFonts` and records font names; the two
  transliteration assertions flip to "ő/ű preserved" (AC4) and a new
  fallback test keeps the old expectations (AC6).
- `scripts/prepare-server-pdf-deps.mjs` — add
  `assets/fonts/pdf/*.ttf` → `dist/server/assets/pdf-fonts/` (AC10).
- `scripts/verify-pdf-vendor.mjs` — extend the smoke test (AC11).
- `docs/loop-queue.md` — tick the item when done (Ship phase).

---

## 5. Tests to write first (TDD order)

Write these red, then implement.

1. `lib/invoices/pdf-fonts.test.ts` (`@jest-environment node`, real pdfkit):
   - `resolvePdfFontFiles()` returns both paths and both files exist (AC1/AC2).
   - `registerDocumentFonts(doc)` → `embedded: true`; names match
     `PDF_FONT_REGULAR`/`PDF_FONT_BOLD`; neither matches
     `/^(Helvetica|Courier|Times|Symbol|ZapfDingbats)/` (AC3).
   - after `doc.font(names.regular)` and `doc.font(names.bold)`,
     `doc._font.constructor.name === "EmbeddedFont"` — with a comment
     pointing at plan §1 so nobody "simplifies" this back to `"Helvetica"` (AC3).
   - `doc.widthOfString("Tetőfelújítás") > 0` and the five header labels fit
     their column widths at `pdfFontSizes("small"|"medium"|"large").small`
     using `tableColumns(doc)` (AC9).
   - with `resolvePdfFontFiles` mocked to `null`,
     `registerDocumentFonts` → `{ embedded: false, regular: "Helvetica", … }` (AC2).
2. `lib/invoices/generate-pdf.test.ts`:
   - embedded path: drawn texts contain `Kőfaragó Kft.`, `Tetőfelújítás`,
     `Vevő`, `Fizetési határidő` verbatim, and contain **no** `Köfaragó` /
     `Vevö` (AC4/AC5).
   - fallback path (`jest.mock("@/lib/invoices/pdf-fonts")` →
     `resolvePdfFontFiles: () => null`): drawn texts are transliterated,
     `isWinAnsiSafe` holds for all of them, and `console.error` was called
     once (AC6).
   - font-name audit: every name passed to the mock's `font()` during a full
     render is one of the two embedded names (AC7).
3. `lib/invoices/generate-pdf.integration.test.ts` (`@jest-environment node`,
   real pdfkit + real fonts, no `pdfkit` mock): `generateInvoicePdf` on
   `buildSamplePreviewInvoice()` → buffer starts `%PDF`, includes `FontFile2` (AC8).
   Keep it to one test; it is the slowest in the file.
4. Existing `lib/invoices/document-labels.test.ts` and
   `lib/invoices/pdf-document.test.ts` must stay green unchanged — the
   fallback helpers keep their contract.

Manual (AC13), local only, not in CI:

```bash
node -r ./scripts/lib/alias-loader.mjs -e '…generateInvoicePdf…' > /tmp/sample.pdf
pdftoppm -png -r 110 /tmp/sample.pdf /tmp/sample && pdftotext /tmp/sample.pdf -
```

(`pdftoppm`/`pdftotext` are already installed on the owner's machine.)

---

## 6. i18n keys (hu + en)

**None.** No user-facing UI string changes: the PDF's vocabulary already
comes from `lib/i18n/locales/hu.ts` via `documentLabels()`, and this slice
only changes how those existing strings are *drawn*. `lib/i18n/locales/hu.ts`
and `en.ts` are untouched. The one new human-readable string is the
developer-facing `console.error` on the fallback path, which stays English
and is deliberately not translated.

## 6b. db/schema.ts changes

**None.** No schema change of any kind — neither additive nor destructive.
No migration, no `db:push`.

---

## 7. Risk classification

**none.**

- Not tax-legal: no `lib/tax/`, no tax figure, no NAV production behaviour,
  no marketing/compliance copy. The backlog item itself records the owner's
  call: *"Not tax/legal-gated (this is document rendering/typography, not
  NAV/tax logic or compliance copy) — normal Ship-phase auto-merge applies
  once green."* The NAV XML path (`lib/nav/invoice-xml.ts`) is UTF-8 and is
  not touched.
- Not schema, not nav-production.
- Licensing is handled, not risked: SIL OFL 1.1 explicitly permits embedding
  and redistribution; `OFL.txt` ships with the fonts (AC1).
- Main residual risk is **serverless bundling** — the lambda not finding the
  TTFs. Mitigated three ways: the same `dist/server/assets` pattern that
  `assets/pdfkit-data` already uses in production, a build-time check that
  fails the deploy (AC10/AC11), and a loud, still-rendering fallback (AC6).
- Second residual risk is **repo weight**: ~1.26 MB of binary. Accepted;
  pdfkit subsets on embed, so generated PDFs stay small (a one-page sample
  measured ~4 KB with the subset embedded).

---

## 8. UX notes

**Mobile (375px).** No React Native UI changes. The composer/detail preview
drawer keeps rendering the HTML preview (`preview-html.ts`), so the visible
change is that the downloaded/shared PDF finally matches the preview's
spelling — the preview-vs-PDF mismatch an EV would otherwise notice on a
phone disappears. Check after implementing that the detail screen's
"PDF letöltése" path still returns a valid file on web and native share
(routes `app/api/invoices/[id]/pdf+api.ts`, `…/preview/pdf+api.ts` are
unchanged). Noto Sans at the current `fontScale: "medium"` sizes stays
legible at phone-viewer zoom; its slightly larger x-height reads better than
Helvetica on a small screen.

**Desktop (≥768px).** The PDF opens inline in the browser viewer. Two
improvements to confirm visually: correct ő/ű, and selectable text —
`Ctrl/Cmd+F` for "Tetőfelújítás" now finds it, and copy-paste of the
company/adószám block into an accountant's email keeps its accents.

**Deliberate non-change.** Typeface *style* stays as close to today as
possible (Noto Sans is a neutral grotesque like Helvetica, ~4–5 % wider), so
this slice is a correctness fix, not a redesign — the redesign is the
separate layout item below it in the queue.

---

## 9. Out of scope (separate queue items)

- The InvoHub brand mark / wordmark in the PDF (next queue sub-item).
- The blank-second-page pagination bug in `contentBottom`/`ensureSpace`.
- General PDF ↔ HTML-preview layout parity (cards, table styling, density).
- Changing the HTML preview's `font-family` to match the PDF.
- Font subsetting/optimisation at build time, italic or additional weights,
  a user-selectable document typeface, PDF/A conformance.
- Receipt (nyugta) or export documents — only the invoice PDF path exists today.
- Removing `toWinAnsiSafe` entirely: it stays as the documented fallback.
