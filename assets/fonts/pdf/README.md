# PDF fonts — provenance

`NotoSans-Regular.ttf` and `NotoSans-Bold.ttf` embed a Latin-Extended-A
TrueType font into the invoice PDF (see
`docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md`) so `ő`/`ű` (and
the rest of Hungarian) render correctly instead of being transliterated by
`lib/invoices/document-labels.ts`'s `toWinAnsiSafe` fallback.

## Source

- Package: [`@expo-google-fonts/noto-sans`](https://www.npmjs.com/package/@expo-google-fonts/noto-sans)
  version `0.4.2` (npm tarball, fetched 2026-09-16).
- Files taken from the tarball, renamed:
  - `package/400Regular/NotoSans_400Regular.ttf` → `NotoSans-Regular.ttf`
  - `package/700Bold/NotoSans_700Bold.ttf` → `NotoSans-Bold.ttf`
  - `package/LICENSE_FONT` → `OFL.txt`
- Upstream font: Noto Sans (Google Fonts), static instances, Regular (400)
  and Bold (700).
- Not added as an npm runtime dependency — only the two `.ttf` files and the
  licence are vendored here, following the same committed-asset pattern as
  `assets/pdfkit-data` (see `scripts/prepare-server-pdf-deps.mjs`).

## Licence

SIL Open Font License 1.1 (`OFL.txt` in this directory) — permits embedding
and redistribution inside a generated document.

## Glyph coverage (verified 2026-09-16 via `fontkit`)

`ő ű Ő Ű á é í ó ö ú ü €` all present in `NotoSans-Regular.ttf`.

## Usage

Registered and resolved by `lib/invoices/pdf-fonts.ts`
(`registerDocumentFonts`, `resolvePdfFontFiles`) under the non-standard
names `InvoHubSans` / `InvoHubSans-Bold` — **not** `Helvetica`/
`Helvetica-Bold` (registering under a base-14 name silently falls back to
pdfkit's built-in WinAnsi font and produces garbage — see the plan's §1 for
the verified pitfall).
