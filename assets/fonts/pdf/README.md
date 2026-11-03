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

## Paper fonts (2026-11 invoice redesign)

Fifteen more static TrueType files, one heading + one body family per
"Betűstílus" of the invoice paper. All SIL OFL 1.1, taken **unmodified** from
the `@expo-google-fonts/*` npm tarballs (registry.npmjs.org, fetched
2026-11-03; the packages are NOT dependencies of this repo) and checked
against the sha256 prefixes below (`lib/invoices/pdf-fonts.test.ts` re-checks
them). Each family's `LICENSE_FONT` is vendored next to it as `OFL-<Family>.txt`.
Glyph coverage verified for `áéíóöőúüűÁÉÍÓÖŐÚÜŰ€` in every file.

| Directory / file | Tarball member | Upstream | sha256 (first 16) |
|---|---|---|---|
| `stack-sans/StackSansNotch-Medium.ttf` | `@expo-google-fonts/stack-sans-notch@0.4.0` `500Medium/StackSansNotch_500Medium.ttf` | https://github.com/DylanYoungKoto/Stack-Sans | f0210d49d47f0509 |
| `stack-sans/StackSansNotch-SemiBold.ttf` | same, `600SemiBold/…` | same | a5bc47d8695bc06b |
| `stack-sans/StackSansNotch-Bold.ttf` | same, `700Bold/…` | same | e8e209fbc910e943 |
| `stack-sans/StackSansText-Regular.ttf` | `@expo-google-fonts/stack-sans-text@0.4.0` `400Regular/StackSansText_400Regular.ttf` | same project | 41d0548f8da45fc2 |
| `stack-sans/StackSansText-Bold.ttf` | same, `700Bold/…` | same | 4ca8faed9488ce0c |
| `source/SourceSerif4-Medium.ttf` | `@expo-google-fonts/source-serif-4@0.4.2` `500Medium/SourceSerif4_500Medium.ttf` | https://github.com/adobe-fonts/source-serif | 52307f3b40a41395 |
| `source/SourceSerif4-SemiBold.ttf` | same, `600SemiBold/…` | same | f8ca116c25700ca7 |
| `source/SourceSerif4-Bold.ttf` | same, `700Bold/…` | same | d135bf6f4d3846b0 |
| `source/SourceSans3-Regular.ttf` | `@expo-google-fonts/source-sans-3@0.4.2` `400Regular/SourceSans3_400Regular.ttf` | https://github.com/adobe-fonts/source-sans | 7ca2b9c4677ce81d |
| `source/SourceSans3-Bold.ttf` | same, `700Bold/…` | same | 87b3daebd990ba83 |
| `nunito/Nunito-Medium.ttf` | `@expo-google-fonts/nunito@0.4.2` `500Medium/Nunito_500Medium.ttf` | https://github.com/googlefonts/nunito | 2590799f71eef8d4 |
| `nunito/Nunito-SemiBold.ttf` | same, `600SemiBold/…` | same | c7fd194467c320db |
| `nunito/Nunito-Bold.ttf` | same, `700Bold/…` | same | ad443e47990c5fc4 |
| `nunito/NunitoSans-Regular.ttf` | `@expo-google-fonts/nunito-sans@0.4.2` `400Regular/NunitoSans_400Regular.ttf` | https://github.com/Fonthausen/NunitoSans | 5539bb068f72fd45 |
| `nunito/NunitoSans-Bold.ttf` | same, `700Bold/…` | same | 484d8229d8aed92f |

"Source" is a Reserved Font Name of Adobe (Source Serif 4, Source Sans 3):
embed them unmodified only (the PDF embeds a subset, which the OFL permits).

Registry: `PAPER_FONT_FILES` / `registerPaperFonts` in
`lib/invoices/pdf-fonts.ts`; bundled by `scripts/prepare-server-pdf-deps.mjs`
into `dist/server/assets/pdf-fonts/<dir>/` and verified by
`scripts/verify-pdf-vendor.mjs`.

## Usage

Registered and resolved by `lib/invoices/pdf-fonts.ts`
(`registerDocumentFonts`, `resolvePdfFontFiles`) under the non-standard
names `InvoHubSans` / `InvoHubSans-Bold` — **not** `Helvetica`/
`Helvetica-Bold` (registering under a base-14 name silently falls back to
pdfkit's built-in WinAnsi font and produces garbage — see the plan's §1 for
the verified pitfall).
