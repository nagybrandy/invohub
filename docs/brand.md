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

### The mark — "the open ledger hub"

Two mirrored corner brackets describe a square frame — the ledger page — but the
two corners on the 45° axis are left **open**, so the frame reads as a gateway
rather than a closed box. A hub sits at the centre, and two links spring from it
out through both gates: value enters through one gate, is recorded at the hub,
and leaves through the other.

The letterform reading: the brackets' two upright arms are the stems of an
**H**, the link crossing between them is its crossbar, and that same stroke
running through the hub is the **I** — I and H sharing one diagonal.

Everything is built on a single diagonal axis (`x + y = 48` on the 48-unit
grid). That is what makes the mark tile: repeated, neighbouring links meet end
to end and form continuous diagonal chains with no visible seam.

Three modes, all from the same geometry:

1. **Standalone** — app icon, avatar, favicon. Legible from 16px up.
2. **Texture** — the 96-unit tile repeated at 4–8% opacity as a background.
3. **Watermark** — one oversized instance, rotated, behind content.

### Two directions — pending the owner's choice

The mark ships in two parallel directions. They share the concept, the grid, the
palette, the proportions and every placement; only the character differs.

| Direction | Character | Assets |
|-----------|-----------|--------|
| **A `angular`** | Chamfered corners, mitred joins, all filled paths. Sharp, technical. | `assets/brand/directions/angular/` |
| **B `rounded`** | The same composition softened: round caps and joins, semicircular bracket corners, circular hub. | `assets/brand/directions/rounded/` |

Compare them side by side — icon at every size, lockup, favicon, blog header,
hero texture, soft band, CTA watermark — at **`marketing/brand-directions.html`**
(`npm run marketing` → `/brand-directions`).

`BRAND_MARK_DEFAULT` in `components/marketing/brand-mark-geometry.ts` selects the
direction for the whole product; it is `rounded` today. To switch: change that
constant, then mirror the chosen SVGs into `assets/brand/mark.svg`,
`assets/brand/mark-pattern.svg` and `marketing/assets/{mark,mark-inverse,favicon}.svg`,
and update the inline SVG in `marketing/index.html` and `marketing/brand-assets.html`.

### Rules

- Two-tone is navy/white brackets + **cornflower** hub and links. Never green.
- Monotone (one ink, `currentColor`) is the default for small sizes and for any
  surface where the accent would not hold contrast.
- Decoration stays at or below **8%** opacity and is always inert — it must
  never intercept input, reach a screen reader, or affect text contrast.
  `BrandTexture` hard-caps opacity at 0.14.
- The mark is static. No animation, so there is nothing to opt out of under
  reduced motion.
- The floating site header keeps the **typography-only** lockup — at ~22px
  beside the nav pill the mark reads as clutter. Footers and app chrome with
  room use the paired lockup.
- **Not in the hero.** The brand texture was tried behind the hero copy and
  rejected for competing with it; the hero keeps its restrained dot field
  (`.hero::before`). The mark earns its place lower down — the final CTA
  watermark and the footer lockup.

### Assets

| Asset | Path | Use |
|-------|------|-----|
| Mark (recolourable) | `assets/brand/mark.svg` | Selected direction; `currentColor` + `--ih-mark-accent` |
| Texture tile | `assets/brand/mark-pattern.svg` | Selected direction; seamless 96×96 repeat |
| Direction A kit | `assets/brand/directions/angular/{mark,mark-pattern,app-icon}.svg` | Candidate A |
| Direction B kit | `assets/brand/directions/rounded/{mark,mark-pattern,app-icon}.svg` | Candidate B |
| Mark on navy tile | `marketing/assets/mark.svg` | App icon / avatar lockup |
| Mark for dark surfaces | `marketing/assets/mark-inverse.svg` | Plate-free, white + cornflower |
| Favicon | `marketing/assets/favicon.svg` | Browser tab |
| Display font | `marketing/assets/fonts/ranade-500.woff2`, `ranade-700.woff2` | Header wordmark + display headings |
| Open Graph cover | `marketing/assets/og-cover.png` | Social previews (1200×630) |
| Square logo | `marketing/assets/logo-512.png` | JSON-LD logo source |

`marketing/brand-assets.html` is the render source for the two PNG rasters;
re-screenshot it after any change to the mark — **both rasters still show the
pre-mark artwork and need regenerating.**

### In code

| Surface | Entry point |
|---------|-------------|
| Geometry, both directions | `components/marketing/brand-mark-geometry.ts` |
| Shared SVG renderer | `components/marketing/BrandShapes.tsx` |
| Mark + wordmark lockup | `components/marketing/BrandLogo.tsx` — `BrandMark`, `BrandLogo` |
| Background decoration | `components/marketing/BrandTexture.tsx` |
| Static site | `.cta__mark` watermark and `.brand--mark` lockup in `marketing/assets/site.css` |

Both components render through `react-native-svg`, so they are identical on web
and native. Pass `tone="onDark"` on navy chrome, `tone="onLight"` on mist and
canvas, and `mark="angular" | "rounded"` to override the default direction.
`BrandLogo` takes `withMark` to pair the glyph with the wordmark. `BrandTexture`
takes `variant="tile" | "mark"` plus `tile` / `size`, `rotate` and `opacity`.

The wordmark itself stays self-hosted **Ranade**
(`marketing/assets/fonts/ranade-*.woff2`, Fontshare): `Invo` + accent `Hub`.
