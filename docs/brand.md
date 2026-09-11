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

The mark is a cut-corner document with ascending accent bars. It is authored as
vector art; rasters are generated from it, never drawn by hand or by an image model.

| Asset | Path | Use |
|-------|------|-----|
| Mark (light surfaces) | `marketing/assets/mark.svg` | Navy tile version |
| Mark (dark surfaces) | `marketing/assets/mark-inverse.svg` | Tile-free glyph for navy chrome |
| Favicon | `marketing/assets/favicon.svg` | Simplified glyph for 16–32px |
| Open Graph cover | `marketing/assets/og-cover.png` | Social previews (1200×630) |
| Square logo | `marketing/assets/logo-512.png` | JSON-LD logo, icon source art |
| Workflow infographic | `assets/marketing/invohub-infographic-workflow.jpg` | App-side marketing visual |
| Bento infographic | `assets/marketing/invohub-infographic-bento.jpg` | App-side marketing visual |

Rasters are regenerated from `marketing/brand-assets.html`:

```bash
node scripts/render-brand-assets.mjs
```

In the app, use `BrandLogo` / `BrandMark` from `components/marketing/BrandLogo.tsx`
(vector, `react-native-svg`) instead of ad-hoc icon markup. Pass `tone="onDark"` on
navy chrome so the mark drops its tile and keeps contrast.
