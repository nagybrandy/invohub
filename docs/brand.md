// docs/brand.md
# InvoHub brand system

## Core palette

| Token | Hex | Role |
|-------|-----|------|
| Navy | `#111f4a` | Primary brand depth, headers, footers (`secondary`) |
| Depth | `#1f305e` | Elevated navy panels and roadmap surfaces |
| Cornflower | `#6495ed` | Interactive primary / accent |
| Pale blue | `#d9e7ff` | Soft accent fills |
| Mist | `#edf2fa` | Marketing soft section backgrounds |
| Neutrals | `#f6f6f8` … `#212325` | Canvas, borders, body text |

**Green is not a brand color.** Use green only for success / paid states (`#15803d`).

## Marketing surfaces

- Hero and chrome: navy (`#111f4a`)
- Soft capability band: mist (`#edf2fa`)
- Display panels: large marketing radius (`28px` / `rounded-marketing`)
- Display headings: Stack Sans Notch via `font-heading`, oversized hero scale

## Artwork

The public wordmark is typography-first for now: self-hosted **Syne**
(`marketing/assets/fonts/syne-*.woff2`) with `Invo` + accent `Hub`. A dedicated
mark glyph is deferred until a stronger direction lands.

Legacy vector mark files remain under `marketing/assets/` for favicon/OG
regeneration only; do not put them back in the header.

| Asset | Path | Use |
|-------|------|-----|
| Display font | `marketing/assets/fonts/syne-700.woff2`, `syne-800.woff2` | Header wordmark + display headings |
| Favicon | `marketing/assets/favicon.svg` | Browser tab (interim) |
| Open Graph cover | `marketing/assets/og-cover.png` | Social previews (1200×630) |
| Square logo | `marketing/assets/logo-512.png` | JSON-LD logo source |

In the app, `BrandLogo` / `BrandMark` from `components/marketing/BrandLogo.tsx`
are typography stand-ins (`InvoHub` / `IH`). Pass `tone="onDark"` on navy chrome.
