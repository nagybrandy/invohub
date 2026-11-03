# Invoice paper redesign (Dóri, 2026-11): plan

Status: plan only. Built on `slice/invoice-paper-redesign`, branched from
`slice/invoice-appearance-snapshot` (local, not yet on origin or `main`; this
work **depends on it** and must ship together with it or after it).

- Design measurements: [`paper-css.md`](paper-css.md)
- Screenshots of the design: [`reference/`](reference/) (2x, paper element only).
  Today's renderer for comparison: [`reference/today/`](reference/today/)
  (80 dpi `pdftoppm` renders of `buildSamplePreviewInvoice()`: invoice, draft,
  EUR/en, AAM, storno).

Owner request: "Dóri a számlaképet is frissítette, frissítsd te is." Dóri's
design is the baseline for look and layout. Hard limits: every mandatory
element of Áfa tv. 169. § and every existing document label stays on every
variant; no legal wording, VAT logic, numbering, NAV XML or `lib/nav/**`
change; **an issued invoice never changes appearance**; additive schema only;
`app/(app)/settings/pdf.tsx` and other screens are not touched (a parallel
screen redesign wires the controls later).

---

## 1. What exists today (read on `slice/invoice-appearance-snapshot`, 382e422)

| Piece | Today |
|---|---|
| Renderer | `lib/invoices/generate-pdf.ts` `generateInvoicePdf(ctx)`: the **only** document renderer (pdfkit, A4, 48 pt margins, `bufferPages`). Header (logo badge/image 40 pt + name + "city · Adószám"), title + number right, status chip only for draft/paid/cancelled; storno/helyesbítő reference line; meta strip (Kiállítás kelte, Teljesítés kelte if set, Fizetési határidő, Fizetési mód if set, Pénznem, Árfolyam if non-HUF); Kibocsátó/Vevő blocks; 6-column table (Megnevezés, Mennyiség, Egységár, Nettó, ÁFA, Bruttó) with continuation caption + repeated header; ÁFA-összesítő + Fizetési információ box (left) and totals + navy amount-due band (right), "ÁFA összege forintban" for non-HUF; AAM/TAM/FAD reason panel; notes with continuation label; footer on every page (footer text, page indicator when multi-page, InvoHub mark + attribution); 4 pt accent bar across every page top. |
| Helpers | `pdf-layout.ts` (logo badge/image, `loadLogoImage`, `tint`, `tableColumns`, table header/row, party block, margins, `ensureSpace`), `pdf-brand-mark.ts`, `document-ink.ts` (palette), `document-labels.ts` (all labels from `lib/i18n/locales/{hu,en}.ts` `invoices.document`), `pdf-fonts.ts` (Noto Sans Regular/Bold embedded as `InvoHubSans*`; Helvetica + ő->ö fallback), `pdf-document.ts` (AFM path patch). |
| Template | `pdf-template/types.ts` `InvoicePdfTemplate` = titleText, accentColor, showCompanyBlock, showBankDetails, showClientTaxNumber, footerText, notesLabel, fontScale. `defaults.ts`: `DEFAULT_PDF_TEMPLATE` (accent `#6495ed`, footer "Köszönjük a bizalmat!"), `mergePdfTemplate`, `normalizeHexColor`, `parsePdfTemplateSnapshot`, `localizePdfTemplate`. |
| Storage | `invoice_pdf_template` (one row per user, `db/schema.ts` l. 394) and `invoice.pdf_template_snapshot` jsonb (l. 286), written by `upsertInvoice` in the numbering transaction (`lib/invoices/service.ts` l. 450). `upsertPdfTemplate` first freezes the current look onto issued invoices that have no snapshot. |
| Context | `build-pdf-context.ts` `loadTemplate`: issued (non-draft, numbered) -> snapshot, else live template. Company (name, address, bank, `logoUrl`) and the buyer fallback are read live. |
| API | `app/api/pdf-template+api.ts`: GET, PATCH (upsert, **no validation**: body cast and merged onto the defaults), POST (renders the sample invoice with an unsaved template). PDF routes: `/api/invoices/[id]/pdf`, `/api/invoices/preview/pdf` (composer draft), `/api/v1/invoices/[id]/pdf`, e-mail attachment. All go through `buildInvoicePdfContext` + `generateInvoicePdf`. |
| Preview | `components/invoices/InvoicePdfPreview.tsx` + `PdfPreviewEmbed.tsx` (double-buffered embed) + `hooks/useInvoicePdfPreview.ts`, `hooks/usePdfTemplate.ts` (`previewSample` = POST). **The preview already is the PDF** (no HTML paper since 2026-09-22). |
| Bundle | `scripts/prepare-server-pdf-deps.mjs` copies `assets/fonts/pdf/NotoSans-{Regular,Bold}.ttf` to `dist/server/assets/pdf-fonts/`; `scripts/verify-pdf-vendor.mjs` asserts an embedded font; `vercel.json` `includeFiles: "dist/**, assets/pdfkit-data/**, node_modules/pdfkit/**"` already covers `dist/server/assets/pdf-fonts/**`. |
| Logo | `company.logo_url` column exists; no screen sets it; `POST /api/companies` accepts any string; `loadLogoImage` decodes `data:` or **fetches any http(s) URL server-side**. No blob/file storage in the repo (`@vercel/blob` absent; `lib/invoices/storage.ts` is AsyncStorage). |

Toggle guardrails today (asked to "keep" them, so recorded exactly):

- `showCompanyBlock=false` hides the Kibocsátó block. The header still prints
  the issuer name and "city · Adószám" (only when `company.name` is set), so the
  issuer's **street address disappears** (city only). There is no guard.
- `showBankDetails=false` hides "Bankszámlaszám" in the issuer block and the
  whole Fizetési információ box. Fine: a bank account is not a 169. § element.
- `showClientTaxNumber=false` hides the buyer's "Adószám" unconditionally. There
  is no guard.

So the only "guardrail" today is that the header keeps name + tax number.
Section 6 defines real guards for the new layouts; the legacy renderer keeps
today's behaviour byte for byte, because issued invoices must not change.

Today vs design, in one line each: the redesign drops the 4 pt page-top bar,
the navy amount-due band and the footer brand mark; it adds a brand-coloured
2 px rule under the header, a layout-dependent meta strip / party / bank
treatment, brand-coloured title and table header, three font pairings, logo
size/position, a bank strip, and larger type (body 11.7 pt vs 9 pt).

## 2. Canonical design

The Számla testreszabása paper (`.pp`) is canonical. Reasons in
`paper-css.md` section 1: newest, the only one driven by the appearance options,
and named by the README as the live preview. From the Új számla paper we take
only the draft watermark. The detail screen has no paper design (embeds the
PDF). Where the canonical paper leaves out mandatory content, the content
comes from today's renderer, styled in the canonical vocabulary (section 4).

## 3. Template model

### 3.1 Type (`lib/invoices/pdf-template/types.ts`)

```ts
export type PdfLayout = "legacy" | "clean" | "band" | "frame";
export type PdfFontStyle = "invohub" | "classic" | "round";
export type PdfLogoMode = "monogram" | "own" | "none";
export type PdfLogoSize = "S" | "M" | "L";
export type PdfLogoPosition = "left" | "right";

export type InvoicePdfTemplate = {
  // existing
  titleText: string; accentColor: string;
  showCompanyBlock: boolean; showBankDetails: boolean; showClientTaxNumber: boolean;
  footerText: string; notesLabel: string; fontScale: PdfFontScale;
  // new
  layout: PdfLayout;            // "legacy" = today's renderer, frozen
  fontStyle: PdfFontStyle;      // ignored by legacy
  logoMode: PdfLogoMode;        // ignored by legacy (legacy: image if logoUrl else badge)
  logoSize: PdfLogoSize;        // ignored by legacy
  logoPosition: PdfLogoPosition;// ignored by legacy
};
```

`fontScale` stays (legacy uses it; the new layouts use Dóri's fixed sizes and
ignore it; Dóri's form has no size control).

### 3.2 Two default sets (`lib/invoices/pdf-template/defaults.ts`)

```ts
// Today's values, frozen forever. Only for legacy rendering and old data.
export const LEGACY_PDF_TEMPLATE: InvoicePdfTemplate = {
  titleText: "SZÁMLA", accentColor: "#6495ed",
  showCompanyBlock: true, showBankDetails: true, showClientTaxNumber: true,
  footerText: "Köszönjük a bizalmat!", notesLabel: "Megjegyzés", fontScale: "medium",
  layout: "legacy", fontStyle: "invohub", logoMode: "monogram", logoSize: "M", logoPosition: "left",
};

// Dóri's "Alapértelmezés visszaállítása" selection: new users, reset, and
// any user without a stored row (see 3.4).
export const DEFAULT_PDF_TEMPLATE: InvoicePdfTemplate = {
  titleText: "SZÁMLA", accentColor: "#3F6BC4",
  showCompanyBlock: true, showBankDetails: true, showClientTaxNumber: true,
  footerText: "Köszönjük a bizalmát!", notesLabel: "Megjegyzés", fontScale: "medium",
  layout: "frame", fontStyle: "invohub", logoMode: "monogram", logoSize: "M", logoPosition: "left",
};
```

Keep the export name `DEFAULT_PDF_TEMPLATE` for the new-user set (the settings
screen and hooks import it), and switch every **legacy** use of defaults to
`LEGACY_PDF_TEMPLATE`:

- `parsePdfTemplateSnapshot`: a missing or invalid field falls back to
  `LEGACY_PDF_TEMPLATE`; **a missing or unknown `layout` means `"legacy"`**.
  Every snapshot written before this ships lacks `layout`, so it renders exactly
  as today.
- `generate-pdf.ts` legacy path merges with `LEGACY_PDF_TEMPLATE` (today:
  `mergePdfTemplate(ctx.template ?? DEFAULT_PDF_TEMPLATE)`).
- `localizePdfTemplate(t, locale)` compares against the default texts of the set
  that matches `t.layout` (legacy: only "Köszönjük a bizalmat!"; new: only
  "Köszönjük a bizalmát!"; both -> "Thank you for your business!"), so a
  legacy custom footer that happens to equal the new default is not translated.

### 3.3 Columns (migration, additive)

`db/schema.ts`, table `invoice_pdf_template`:

```ts
layout:       text("layout").notNull().default("legacy"),
fontStyle:    text("font_style").notNull().default("invohub"),
logoMode:     text("logo_mode").notNull().default("monogram"),
logoSize:     text("logo_size").notNull().default("M"),
logoPosition: text("logo_position").notNull().default("left"),
```

Then `npx drizzle-kit generate` only (expected `drizzle/0014_*.sql`: five
`ALTER TABLE "invoice_pdf_template" ADD COLUMN ... DEFAULT ... NOT NULL`). No
`db:push` (Ship does that). The **column** default `legacy` is what keeps every
existing row on today's look; new rows never rely on it, because the service
always inserts explicit values (new-user default `frame`). `invoice.pdf_template_snapshot`
needs no change (jsonb; it simply starts carrying the new keys).

### 3.4 Which template a render uses (`build-pdf-context.ts`, `service.ts`)

| Invoice | Template |
|---|---|
| Draft (`status=draft` or no number) | live template: `mapRow(row)` or `DEFAULT_PDF_TEMPLATE` when the user has no row |
| Issued, has snapshot | the snapshot, parsed (no `layout` -> legacy) |
| Issued, **no snapshot** (issued before snapshots) | new `getLegacyAppearance(userId)` = `{ ...(row ? mapRow(row) : LEGACY_PDF_TEMPLATE), layout: "legacy" }` |

The third row closes a gap: today such invoices follow the live template, and a
user **without** a row would otherwise flip to the new design the moment
`DEFAULT_PDF_TEMPLATE` changes. Same rule in
`freezeAppearanceOfUnsnapshottedInvoices`: it must freeze
`getLegacyAppearance`, never the new-user defaults and never a non-legacy
layout (everything issued without a snapshot was rendered by the legacy code).

`upsertPdfTemplate` merges the input **onto the user's stored template**
(`mapRow(existing)`, or `DEFAULT_PDF_TEMPLATE` when there is no row), not onto
the defaults as today. Otherwise a PATCH that omits `layout` (any old client)
would silently move a legacy row to `frame`. Insert and update write all five
new columns explicitly.

`upsertInvoice` already snapshots `getPdfTemplate(userId)` at issue time: once
the type has the new fields, the snapshot carries them with no code change
there (add a test).

## 4. Renderer: one legacy (frozen) + one parametrised paper renderer

```
generateInvoicePdf(ctx)                      lib/invoices/generate-pdf.ts (dispatcher, same export)
  template = resolve(ctx.template)           (missing -> DEFAULT for drafts/sample, parse rules above)
  content  = buildDocumentContent(ctx, template, labels)   lib/invoices/document-content.ts (pure)
  layout === "legacy" ? renderLegacyPdf(...)              lib/invoices/pdf-legacy.ts (today's body)
                      : renderPaperPdf(..., paperVariant(template))   lib/invoices/paper/render-paper.ts
```

- **Legacy**: today's function body moved unchanged into `pdf-legacy.ts`. It is
  frozen: its output is pinned by golden hashes (test plan 9.1) recorded
  **before** the move. It may consume `buildDocumentContent` only if the golden
  hashes stay identical.
- **Paper renderer**: one function for all of Letisztult / Sávos / Keretes x
  three font styles x logo modes. Variation is data, not branches:
  `paperVariant(template)` returns `{ layout tokens, font set, logo spec,
  colours }`; each block reads its treatment from the tokens.
- **`buildDocumentContent`** (pure, unit-testable): everything *what* to
  print, derived with exactly today's rules: title (`documentTitleFor` /
  `titleText` for a plain számla), number or `labels.draftNumber`, status chip
  (`documentStatusChip`), storno/helyesbítő reference text, meta cells
  (incl. Teljesítés kelte when resolved, Fizetési mód when set, Árfolyam when
  non-HUF), seller lines, buyer lines, formatted rows (`formatDocumentAmount`,
  `formatDocumentQuantity`, VAT cell `27%` / category code), totals rows incl.
  "ÁFA összege forintban", refund vs payable label, VAT summary by rate,
  payment lines, exemption reasons (`resolveVatExemptionReason`), notes,
  continuation banner text, page indicator template. The paper renderer only
  lays this out. No VAT/rounding/numbering logic is added or changed; it calls
  the existing functions.

### 4.1 Geometry

`PX = 595.28 / 560` (pt per design px). Page margins from the design: top 34,
sides 34, bottom 20 px + footer band (footer top at 748 px = 795 pt; content
bottom = footer top - 12 px gap). Block gap 12 px. All sizes below in design
px; the renderer multiplies by `PX`.

### 4.2 Block mapping (design -> pdfkit)

| Block | Drawn as | Variant parameters |
|---|---|---|
| Header | Row: [logo][issuer] and [tag][title / "Sorszám: n"]. Issuer: name 12 px body-700 `#222`; line 2 = `"{address} · {Adószám}: {taxNumber}"` 9.5 px `#666` (always, see 6). Title 21 px heading-700, colour `ink` (darkened brand), letter-spacing 0.01 em, fitted with the existing `fitHeaderColumn` step-down so ELŐLEGSZÁMLA / HELYESBÍTŐ SZÁMLA never wrap. Under it `"{labels.documentNumber}: {number}"` 9.5 px `#666`. Tag = status chip text uppercase (only when `documentStatusChip` is non-null), 8 px body-700 `#555` on `#EEF0F4`, radius 4, padding 1x6. | `logoPosition=right` swaps the two columns and left-aligns the title column. |
| Logo | Monogram: rounded square `sz`, radius 6, fill `ink`, white initials in body-700 at round(sz x 0.42) px (existing `companyInitials`, plus the prototype's rule of stripping "e.v./kft./zrt./bt." so "Kovács Anna e.v." gives "KA"; extend its tests). Own: `doc.image(buffer, { fit: [min(120, …), sz] })`. None: nothing. | `sz` = S 22 / M 30 / L 42 px. `own` without a usable image falls back to Monogram (never the dashed "logó" placeholder on a real document). |
| Rule | 2 px rect, full content width, `ink`. | same everywhere |
| Reference (storno/helyesbítő) | `labels.referenceStorno/Modify` 10.5 px body-700 `#222` under the rule. | same |
| Meta strip | N equal cells (N = 3..6 by content), padding 7x9, caption (heading-600 7.5 px, tracking 0.07 em, `#555`, uppercase) + value 10.5 px body-700. | clean: no fill, bottom 1 px `#E6E8EC`; band: `tint` fill, square; frame: `tint` fill, radius 8, 1 px border `mix(ink, white, .35)`, 1 px `#E6E8EC` dividers. |
| Parties | Two cells (or one when the issuer box is hidden): caption KIBOCSÁTÓ / VEVŐ, name 10.5 px body-700, lines 9.5 px `#666`. Seller lines: address, Adószám, Bankszámlaszám (if `showBankDetails`). Buyer lines: address, Adószám (rule in 6), Közösségi adószám. | clean: bottom hairline, no left padding; band: plain, no left padding; frame: 1 px `#E6E8EC` box radius 8 + divider. |
| Line items | Six columns as today (Megnevezés, Mennyiség, Egységár, Nettó, ÁFA, Bruttó: existing labels, uppercased). Header 8 px heading-500, tracking 0.05 em, padding 5x7; rows 10 px body, padding 6x7, 1 px `#EEE` rule; description and gross body-700; per-line comment under the description 9.5 px `#666`; numeric columns right-aligned, widths measured as today (`tableColumns`). Continuation: banner `"{number} · folytatás"` + repeated header, exactly today's break rule. | clean: no fill, header text `ink`, 2 px `ink` underline; band/frame: header fill `ink`, white text. |
| VAT summary (ÁFA-összesítő) | Not in the design but mandatory content today: caption + 4-column mini table (ÁFA-kulcs, Nettó, ÁFA összeg, Bruttó) in the column left of the totals; if its measured minimum width does not fit, a full-width row above the totals. Header row uses the same treatment as the item table header at 7.5 px. | follows the items header treatment |
| Totals | Right block, width 55 % (271 px): rows 10 px, label `#444`, value `#222`; grand row: 2 px `ink` top rule, padding-top 6, caption (FIZETENDŐ ÖSSZESEN / VISSZATÉRÍTENDŐ ÖSSZEG) + value 15 px body-700 `#111`. Non-HUF adds "ÁFA összege forintban". | same everywhere |
| Payment strip | When today's payment box would show (transfer or unset, not a refund, `showBankDetails`, bank account set): caption `labels.paymentDetails` above, then cells Bankszámlaszám (1.4 fr) / Közlemény (when numbered) / Fizetési határidő, values 11 px body-700 tracking 0.02 em, padding 8x10. With `showBankDetails=false` on a transfer invoice: Dóri's single-cell strip (Fizetési határidő). | clean: top hairline; band: `tint` fill; frame: 1 px box radius 8 + dividers. |
| AAM/TAM/FAD/... statement | Every reason line, 10 px `#333`, in a panel with a 3 px `ink` bar on the left, padding 8x10. | clean: no fill; band: `tint` fill; frame: 1 px box radius 8. |
| Notes | Caption = `notesLabel` uppercased (no colon), text 10 px `#333`; continuation keeps today's `"{label} (folytatás)"` caption via the same `pageAdded` listener pattern. | same |
| Footer (every page) | 1 px `#E5E6EA` rule; left `footerText` 9.5 px `#555`; centre page indicator when multi-page; right `labels.footer` ("Készült az InvoHub-bal · invohub.hu") text only, no mark, in `documentInk.muted` (open question 6). | same |
| Draft watermark | Unnumbered draft only, every page: `labels.draftNumber` heading-700 ~79 px, rotated -24°, centred at 50 % / 48 %, brand colour at fill opacity 0.07. | same |

Colours: `ink = darkOf(accentColor)`, `tint = mix(accentColor, white, 0.12)`
(algorithm and test vectors in `paper-css.md` section 3; new
`lib/invoices/paper/brand-color.ts`). Header row, rule, table header and logo
use `ink`, never the raw colour, so white-on-`ink` and `ink`-on-white always
reach 4.5:1.

### 4.3 Fonts

| fontStyle | heading (500 / 600 / 700) | body (400 / 700) |
|---|---|---|
| invohub | Stack Sans Notch | Stack Sans Text |
| classic | Source Serif 4 | Source Sans 3 |
| round | Nunito | Nunito Sans |

`lib/invoices/pdf-fonts.ts` grows a registry: `registerPaperFonts(doc, style)`
registers five non-base-14 names (`IHPaper-<style>-head-500`, …), returns
`{ head500, head600, head700, body400, body700, embedded }`. Font buffers are
read once per process (module cache keyed by path; pdfkit `registerFont`
accepts a Buffer). Fallback order: style files missing -> the existing Noto Sans
pair for every role (`console.error` once) -> Helvetica + the existing
`toWinAnsiSafe` path. Amount cells pass `features: ["tnum"]` when the font has
it (Stack Sans and Source Serif yes; Source Sans 3 is tabular by default;
Nunito Sans has none, harmless).

## 5. Font files to add

All SIL OFL 1.1, verified with fontkit: static (non-variable) TTF, every
Hungarian letter present (`áéíóöőúüűÁÉÍÓÖŐÚÜŰ` and `€`), and embedded by this
repo's pdfkit as `EmbeddedFont` (test render 2026-11-03). Source: the
`@expo-google-fonts/*` npm tarballs (same pattern as Noto Sans in
`assets/fonts/pdf/README.md`), each tarball's `LICENSE_FONT` copied as the OFL
text.

| Commit as `assets/fonts/pdf/<dir>/` | From tarball | Upstream / licence | sha256 (first 16) |
|---|---|---|---|
| `stack-sans/StackSansNotch-Medium.ttf` | `@expo-google-fonts/stack-sans-notch@0.4.0` `500Medium/StackSansNotch_500Medium.ttf` | https://github.com/DylanYoungKoto/Stack-Sans, OFL 1.1, Google Fonts "Stack Sans Notch" | f0210d49d47f0509 |
| `stack-sans/StackSansNotch-SemiBold.ttf` | same, `600SemiBold/…` | same | a5bc47d8695bc06b |
| `stack-sans/StackSansNotch-Bold.ttf` | same, `700Bold/…` | same | e8e209fbc910e943 |
| `stack-sans/StackSansText-Regular.ttf` | `@expo-google-fonts/stack-sans-text@0.4.0` `400Regular/StackSansText_400Regular.ttf` | same project, Google Fonts "Stack Sans Text" | 41d0548f8da45fc2 |
| `stack-sans/StackSansText-Bold.ttf` | same, `700Bold/…` | same | 4ca8faed9488ce0c |
| `source/SourceSerif4-Medium.ttf` | `@expo-google-fonts/source-serif-4@0.4.2` `500Medium/SourceSerif4_500Medium.ttf` | https://github.com/adobe-fonts/source-serif, OFL 1.1 (Reserved Font Name "Source": embed unmodified only) | 52307f3b40a41395 |
| `source/SourceSerif4-SemiBold.ttf` | same, `600SemiBold/…` | same | f8ca116c25700ca7 |
| `source/SourceSerif4-Bold.ttf` | same, `700Bold/…` | same | d135bf6f4d3846b0 |
| `source/SourceSans3-Regular.ttf` | `@expo-google-fonts/source-sans-3@0.4.2` `400Regular/SourceSans3_400Regular.ttf` | https://github.com/adobe-fonts/source-sans, OFL 1.1 (RFN "Source") | 7ca2b9c4677ce81d |
| `source/SourceSans3-Bold.ttf` | same, `700Bold/…` | same | 87b3daebd990ba83 |
| `nunito/Nunito-Medium.ttf` | `@expo-google-fonts/nunito@0.4.2` `500Medium/Nunito_500Medium.ttf` | https://github.com/googlefonts/nunito, OFL 1.1 | 2590799f71eef8d4 |
| `nunito/Nunito-SemiBold.ttf` | same, `600SemiBold/…` | same | c7fd194467c320db |
| `nunito/Nunito-Bold.ttf` | same, `700Bold/…` | same | ad443e47990c5fc4 |
| `nunito/NunitoSans-Regular.ttf` | `@expo-google-fonts/nunito-sans@0.4.2` `400Regular/NunitoSans_400Regular.ttf` | https://github.com/Fonthausen/NunitoSans, OFL 1.1 | 5539bb068f72fd45 |
| `nunito/NunitoSans-Bold.ttf` | same, `700Bold/…` | same | 484d8229d8aed92f |

Plus `OFL.txt` per directory (each family's `LICENSE_FONT`; Nunito and Nunito
Sans have different copyright lines, so `nunito/OFL-Nunito.txt` and
`nunito/OFL-NunitoSans.txt`) and a provenance section in
`assets/fonts/pdf/README.md`. Total about 2.7 MB. Tarball URLs:
`https://registry.npmjs.org/@expo-google-fonts/<name>/-/<name>-<version>.tgz`.
Do not add the packages as dependencies; vendor the files only.

Bundle: `scripts/prepare-server-pdf-deps.mjs` copies the whole
`assets/fonts/pdf/**/*.ttf` tree (keeping sub-directories) into
`dist/server/assets/pdf-fonts/` and fails the build if any registry file is
missing; `pdf-fonts.ts` looks in both `dist/server/assets/pdf-fonts/<dir>` and
`assets/fonts/pdf/<dir>`; `scripts/verify-pdf-vendor.mjs` embeds each of the 15
files and asserts `EmbeddedFont` + `FontFile2`. `vercel.json` already ships
`dist/**`; no change needed there (verify after `npm run vercel-build` that
`dist/server/assets/pdf-fonts/stack-sans/StackSansText-Regular.ttf` exists).

## 6. Mandatory content and the three toggles

New layouts (clean/band/frame), on every document type and locale:

- **Issuer identity is never hidden.** The header always prints the issuer's
  name, full address (`formatPartyAddress`) and tax number. This deliberately
  deviates from the prototype, which also removes the header text when
  "Cégadatok blokk" is off. `showCompanyBlock=false` removes only the KIBOCSÁTÓ
  box (the duplicate), and the buyer box takes the full width (`.pty.one`).
  If the company has no name (an incomplete profile can only exist on drafts;
  issuing requires `assertCompanyProfileComplete`), the identity block is
  omitted exactly as today.
- **Bank details**: `showBankDetails=false` hides the bank account in the issuer
  box and the payment strip's bank cells (as today and as designed).
- **Buyer tax number**: on the new layouts the buyer's tax number is printed
  whenever the invoice carries one, regardless of `showClientTaxNumber`.
  Printing a tax number the user entered is never non-compliant; hiding it can
  be (Áfa tv. 169. § d; and the NAV XML reports it for a DOMESTIC buyer, see
  `lib/nav/customer.ts`, so the paper must match the data report). Needs owner
  confirmation (open question 1); the settings UI should then show this toggle
  as locked or drop it.
- **Legacy** keeps today's toggle behaviour exactly (issued documents must not
  change). Its "street address disappears when the company block is off" gap
  is pre-existing and listed as open question 9.

Everything else in today's document stays: document titles per type, number,
dates (incl. Teljesítés kelte), payment method, currency, Árfolyam, every line
column, VAT summary per rate, totals, ÁFA összege forintban, refund label,
exemption/reverse-charge texts, storno/helyesbítő reference, notes, footer
attribution, continuation banner, page indicator.

## 7. Preview path (preview == PDF)

No new preview renderer. Every place that shows the paper keeps showing the
generated PDF from the one dispatcher:

- Számla testreszabása live preview and "Minta PDF letöltése": `POST /api/pdf-template`
  with the unsaved template (now validated, section 8) -> sample invoice -> PDF.
  The screen redesign later debounces this exactly like the composer does
  (`PdfPreviewEmbed` double-buffering already exists). "Alapértelmezés
  visszaállítása" = client sets `DEFAULT_PDF_TEMPLATE` (exported).
- Új számla > Előnézet: `POST /api/invoices/preview/pdf` (draft -> live template ->
  watermark).
- Invoice detail, list drawer, v1 API, e-mail attachment: `/api/invoices/[id]/pdf`
  etc. (snapshot rules in 3.4).

Sample invoice (`pdf-template/sample-invoice.ts`): align it with Dóri's mock so
the settings preview reads like the design: buyer "Tech Solutions Kft." with a
snapshot address (1117 Budapest, Minta utca 12., today the sample has no buyer
address at all), three lines with units (Webfejlesztés (óradíj) 24 óra x 15 000;
Havi karbantartás 1 hó x 45 000; Hosting (éves) 1 db x 36 000; 27 %),
`paymentMethod: "transfer"`, `fulfillmentDate` = issue date, due = issue + 8 days,
note "Fizetési határidő 15 nap, átutalással." Keep the number
`SZLA-PREVIEW-001` (the existing `previewSampleNote` string names it). The
integration test's "sample fits on one page" guard must hold for every layout.

## 8. API validation (`app/api/pdf-template+api.ts`)

New pure validator `lib/invoices/pdf-template/validate.ts`
`validatePdfTemplateInput(body: unknown): { ok: true; value: InvoicePdfTemplateInput } | { ok: false; fields: string[] }`,
used by PATCH and POST:

| Field | Rule |
|---|---|
| body | must be a JSON object, else 400 |
| `layout` | one of `legacy, clean, band, frame` (`legacy` accepted so a client that round-trips a legacy row keeps it) |
| `fontStyle` | `invohub, classic, round` (`custom` rejected: not built) |
| `logoMode` | `monogram, own, none` |
| `logoSize` | `S, M, L` |
| `logoPosition` | `left, right` |
| `fontScale` | `small, medium, large` |
| `accentColor` | `#RGB` or `#RRGGBB` (expanded to 6 digits; anything else 400, no silent fallback) |
| `showCompanyBlock`, `showBankDetails`, `showClientTaxNumber` | booleans |
| `titleText` | string, trimmed, <= 40 chars |
| `notesLabel` | string, trimmed, <= 40 chars (prototype `maxlength=40`) |
| `footerText` | string, trimmed, <= 200 chars |
| unknown keys | ignored |

Error response: `400 { error: "Invalid PDF template.", code: "invalidPdfTemplate", fields: [...] }`
(same shape as `invalidBillingSettings` in `app/api/companies+api.ts`). The
service still normalizes on write and on read (render safety must not depend on
the API). `lib/workspaces/permissions.ts` already lists the route; no change.

## 9. Test plan (TDD order; tests mock `@/db`)

1. **No-restyle golden test, written first, on the untouched base**
   (`lib/invoices/pdf-legacy.golden.test.ts`, real pdfkit, `@jest-environment node`).
   Fixed clock (only `Date` faked; pdfkit output is otherwise deterministic:
   three renders of the sample gave the same sha256). Fixtures: sample
   invoice; draft; EUR + en; AAM; TAM; FAD; mixed 27 %/5 %; storno with
   reference; helyesbítő with reference; díjbekérő; előlegszámla; 40 lines
   (multi-page); 16 lines + 6000-char notes; all three toggles off; custom
   colour + fontScale small and large; logo `data:` PNG. Record sha256 per
   fixture on the base commit; the refactor must keep every hash. These
   fixtures are rendered with a template that has **no** `layout` key (old
   snapshot shape) and with `layout: "legacy"`: both must hit the same hash.
2. `defaults.test.ts`: `parsePdfTemplateSnapshot` without `layout` /
   with an unknown layout -> legacy and legacy defaults for missing fields;
   a full new snapshot round-trips; `localizePdfTemplate` per default set.
3. `service.test.ts`: `mapRow` reads the five columns (unknown values ->
   legacy-safe defaults); no row -> `DEFAULT_PDF_TEMPLATE`; upsert merges onto
   the stored row (PATCH without `layout` keeps `legacy`); insert/update write
   the five columns; freeze writes `getLegacyAppearance` (layout `legacy`) for
   users with and without a row.
4. `build-pdf-context.test.ts`: issued without snapshot, user without row ->
   `LEGACY_PDF_TEMPLATE`; issued without snapshot, row with `frame` -> row
   values with `layout: "legacy"`; issued with new-shape snapshot -> snapshot;
   draft -> live.
5. `validate.test.ts` + `__tests__/api/pdf-template-api.test.ts`: every rule in
   section 8, 400 shape, `#abc` expansion, POST validated too, PATCH passes the
   validated value to the service.
6. `paper/brand-color.test.ts`: the eight vectors in `paper-css.md` section 3,
   and contrast(ink) >= 4.5 for 200 random colours.
7. `pdf-fonts.test.ts`: the registry resolves all 15 files for each style;
   names are non-base-14 and `doc._font` is `EmbeddedFont`; fallback to Noto
   then Helvetica when files are missing; buffers read once.
8. `paper/render-paper.test.ts` (recording pdfkit mock, like
   `generate-pdf.test.ts`): per layout the meta/party/bank/exemption fills,
   borders and radii and the table-header fill vs underline; logo S/M/L
   sizes (22/30/42 x PX), right position swaps columns, `none` draws no
   badge, `own` draws an image from a `data:` PNG/JPEG and falls back to the
   monogram for http(s), SVG or broken data; title colour = `ink`; watermark
   only on unnumbered drafts, on every page; status tag only for
   draft/paid/cancelled; footer on every page with indicator only when
   multi-page; continuation banner + repeated header.
9. **Mandatory-content matrix** (`lib/invoices/document-mandatory.test.ts`,
   recording mock, collects every drawn string): for layouts {legacy, clean,
   band, frame} x fontStyle {invohub, classic, round} x logoMode {monogram,
   own, none} x locale {hu, en} x documentType {invoice, proforma, advance,
   storno, modify}, each with the toggles all on and all off, assert every
   required string is drawn: issuer name, full address, tax number; buyer name,
   address, tax number (new layouts: also with the toggle off); title per type;
   number or draft label; Kiállítás kelte, Teljesítés kelte (when set),
   Fizetési határidő, Pénznem; every row's description / quantity+unit /
   unit price / net / VAT / gross; Nettó összesen, ÁFA összesen, payable or
   refund total; ÁFA-összesítő rows; storno/modify reference text. Extra
   scenario rows on all four layouts: EUR (Árfolyam cell + "ÁFA összege
   forintban"), AAM / TAM / FAD (reason text), 40 lines (continuation banner,
   repeated header labels, page indicator), long notes (continued label).
   Plus a parity assertion: the set of mandatory strings drawn by a new layout
   equals legacy's set for the same fixture (toggles on), so the two can never
   drift apart.
10. `generate-pdf.integration.test.ts` (real pdfkit): the sample is one page in
    every layout x font style; 40 lines paginate with a header on each page;
    `pdffonts`-style check that the 5 paper fonts are embedded (`FontFile2`).
11. `atomic-numbering.test.ts` / `service.test.ts`: the snapshot written at
    issue contains the five new fields.
12. i18n parity (`hu.ts` / `en.ts`) for the new keys (section 10).
13. Visual check before the PR: render the sample in all 9 layout x font
    combinations, logo variants and four colours with `pdftoppm -png -r 80`,
    compare with `reference/*.png`, attach a contact sheet to the PR.

## 10. i18n keys (hu + en, `settings.pdfScreen.*`; for the later screen wiring)

`logo` Logó / Logo; `logoHint` Ez jelenik meg a számlád tetején. / Shown at the
top of your invoice.; `logoMonogram` Monogram / Monogram; `logoOwn` Saját logó /
Own logo; `logoNone` Nincs / None; `logoSize` Méret / Size; `logoPosition`
Elhelyezés / Position; `logoLeft` Bal / Left; `logoRight` Jobb / Right;
`brandColor` Márkaszín / Brand colour; `brandColorHint` Fejlécben és
vonalakban jelenik meg. / Used in the header and rules.; `customColor` Egyedi
szín / Custom colour; `shadeNote` Fejlécben ezt a sötétebb árnyalatot
használjuk: {{hex}} (az olvashatóságért). / The header uses this darker shade
for legibility: {{hex}}.; `fontStyle` Betűstílus / Font style; `fontStyleHint`
Egy a címekhez, egy a szövegekhez. / One for headings, one for text.;
`fontInvohub` InvoHub / InvoHub; `fontClassic` Klasszikus / Classic;
`fontRound` Kerek / Rounded; `layout` Elrendezés / Layout; `layoutHint` A számla
felépítése. / How the invoice is laid out.; `layoutClean` Letisztult / Clean;
`layoutBand` Sávos / Banded; `layoutFrame` Keretes / Framed; `layoutLegacy`
Korábbi / Previous; `visibleData` Megjelenő adatok / Shown on the invoice;
`visibleDataHint` Mi látszódjon a számlán. / What appears on the invoice.;
`notesLabelHint` A megjegyzés fölötti felirat. / The caption above the note.;
`footerTextHint` Ez áll a számla alján. / Printed at the bottom of the
invoice.; `previewWithSample` Előnézet mintaadatokkal / Preview with sample
data; `downloadSample` Minta PDF letöltése / Download sample PDF;
`resetDefaults` Alapértelmezés visszaállítása / Restore defaults; `resetDone`
Alapértelmezett beállítások visszaállítva. Mentsd, ha megfelel. / Defaults
restored. Save if you are happy with them.; `invalidTemplate` Érvénytelen
beállítás. / Invalid setting.

No new **document** labels: the watermark uses `invoices.document.draftNumber`,
the number prefix `documentNumber`, the strip caption `paymentDetails`.

## 11. Build order (next agent, `slice/invoice-paper-redesign`)

1. Golden legacy test (9.1) green on the untouched code; commit.
2. Types + both default sets + parse/localize rules + tests (9.2); schema
   columns + `drizzle-kit generate`; service + context rules (9.3, 9.4).
3. Validator + API (9.5).
4. Move the legacy body to `pdf-legacy.ts`, add the dispatcher (golden hashes
   unchanged); extract `buildDocumentContent` (hashes unchanged).
5. Fonts: vendor files + README + registry + bundle scripts (9.7).
6. Paper renderer block by block with tests (9.6, 9.8), then the matrix (9.9)
   and integration (9.10).
7. Sample invoice update, i18n keys, visual check (9.13), `npm run typecheck`,
   `npm run test:unit`.

## 12. Left out of this slice

- **Saját logó upload**: there is no file storage in the repo and no screen sets
  `company.logo_url`. The renderer supports `logoMode: "own"` with an existing
  `company.logoUrl` that is a `data:image/png` or `data:image/jpeg` URI (pdfkit
  cannot draw SVG; the prototype also accepts SVG), otherwise it falls back to
  the monogram. Upload UI + storage (+ validation of `logoUrl` in
  `POST /api/companies`) is a separate item.
- **Saját párosítás** (custom font pairing from ~30 Google families): would
  need every family vendored or fetched at render time. `fontStyle: "custom"`
  is rejected by the API for now.
- **Settings screen** (`app/(app)/settings/pdf.tsx`): wired by the parallel
  screen redesign; this slice ships the model, API, renderer, i18n keys.
- **fontScale on the new layouts** (Dóri's form has no size control; legacy
  keeps it).
- **"KIÁLLÍTVA" tag** on issued documents (a new document label; today's rule
  prints only draft/paid/cancelled) - open question 4.
- **HTML paper** in settings: not built; the preview is the PDF.
- The composer paper's 8 px top bar and "Az ÁFA-t az adatok alapján számoltuk."
  footer line (not part of the canonical paper).

## 13. Open questions (owner / Dóri / legal)

1. Buyer tax number on the new layouts: always printed when present (this plan)
   and the toggle locked or removed in the UI? Legal sign-off recommended.
2. Users with no template row (never opened Számla testreszabása): their next
   documents get Dóri's design (this plan); their already issued ones stay
   legacy. OK?
3. Should the new settings offer "Korábbi" (legacy) as a fourth layout card for
   users whose row is legacy, so they can go back after trying the new ones?
   (API accepts it either way.)
4. Print a "KIÁLLÍTVA" tag on issued documents as in the design? (Not in this
   plan.)
5. Seller's Közösségi adószám (EU VAT number) is not printed today (the composer
   mock shows it). Legal question, not in this slice.
6. Footer attribution colour: the design's `#888` is 3.5:1 on white; the
   2026-09-21 fix set document ink to >= 4.5:1. This plan uses
   `documentInk.muted` (#5b6178) for it; Dóri to confirm.
7. The logo image (and the issuer's name/address) are read live, not frozen in
   the snapshot, so changing them would alter an issued PDF. Freeze them too?
8. Security: `loadLogoImage` fetches any http(s) `logoUrl` server-side and
   `POST /api/companies` does not validate it (SSRF). Restrict to `data:`
   images in a separate item.
9. Legacy documents with "Cégadatok blokk" off print only the issuer's city in
   the header (pre-existing gap). Legacy cannot change for issued invoices;
   should not-yet-issued legacy-layout drafts get the full address?
10. Ship gate: the document is a legal document. Recommend a PR with owner
    sign-off rather than an auto-merge, with the variant contact sheet and the
    matrix test as evidence.
