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
rather than a closed box. One flow stripe runs the whole diagonal through both
gates: value enters through one gate, is recorded at the hub in the middle, and
leaves through the other.

Two readings, both deliberate:

- **Two figures.** Each bracket is a curled body carrying its own round head, so
  the pair reads as two people either side of the flow. (Chosen direction only —
  the heads are what make this legible at a glance.)
- **H and I.** The two bracket uprights, at the far left and far right, are the
  stems of an **H** and the stripe crossing between them is its crossbar; that
  same stripe, carrying the hub button, is the **I**.

**The parallel wall.** Each bracket end is cut along a line
*parallel to the stripe's own axis* (`x + y = 48`), so the two walls run flush
alongside it with a constant channel rather than meeting it at a mismatched
angle. This is the detail that makes the mark feel drawn rather than assembled.

Everything is built on a single diagonal axis (`x + y = 48` on the 48-unit
grid). That is what makes the mark tile: repeated, neighbouring stripes meet end
to end and form continuous diagonal chains with no visible seam.

Three modes, all from the same geometry:

1. **Standalone** — app icon, avatar, favicon. Legible from 16px up.
2. **Texture** — the 96-unit tile repeated at 4–8% opacity as a background.
3. **Watermark** — one oversized instance, rotated, behind content.

### The chosen direction

**`rounded` is the brand mark.** `angular` — the same composition with sharp
corners, a square-cut stripe and no heads — is kept on disk as an archived
alternative and stays buildable, but is no longer used anywhere.

| Direction | Status | Character | Assets |
|-----------|--------|-----------|--------|
| **`rounded`** | **Chosen** | 14-unit rounded corners; each bracket carries its own round head, so the mark reads as two figures. Round-capped 6.5-unit stripe with a 5.5-unit hub button. | `assets/brand/directions/rounded/` |
| `angular` | Archived | Sharp corners, square-cut stripe, no heads. | `assets/brand/directions/angular/` |

`BRAND_MARK_DEFAULT` in `components/marketing/brand-mark-geometry.ts` selects the
direction for the whole product and is set to `rounded`. Every call site follows
it; `BrandMark`, `BrandLogo` and `BrandTexture` also take an explicit
`mark="angular" | "rounded"` if a one-off ever needs the archived form.

`marketing/brand-directions.html` shows both as complete treatments — icon at
every size, mono and two-tone, app icon, favicon, wordmark lockup, blog header,
hero texture, soft band and CTA watermark (`npm run marketing` →
`/brand-directions`).

### Legibility

Two things must stay readable at a glance, and the geometry is tuned for both:

- **The two figures** read because each head is in the *frame* ink while the
  stripe is in the *accent* ink, and because the channel between walls and
  stripe is wide (6.7 units). Narrowing that channel, or painting the heads in
  the accent colour, collapses the mark back into one blob.
- **The H and I** read because the two bracket uprights sit at the far left and
  far right of the frame, where an H's stems belong, with the stripe crossing
  between them as the crossbar — and that same stripe, carrying the hub button,
  is the I.

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
| Mark (recolourable) | `assets/brand/mark.svg` | Chosen direction; `currentColor` + `--ih-mark-accent` |
| Texture tile | `assets/brand/mark-pattern.svg` | Chosen direction; seamless 96×96 repeat |
| Chosen kit | `assets/brand/directions/rounded/{mark,mark-pattern,app-icon}.svg` | `rounded` — the brand mark |
| Archived kit | `assets/brand/directions/angular/{mark,mark-pattern,app-icon}.svg` | `angular` — kept, unused |
| Mark on navy tile | `marketing/assets/mark.svg` | App icon / avatar lockup |
| Mark for dark surfaces | `marketing/assets/mark-inverse.svg` | Plate-free, white + cornflower |
| Favicon | `marketing/assets/favicon.svg` | Browser tab |
| Display font | `marketing/assets/fonts/ranade-500.woff2`, `ranade-700.woff2` | Header wordmark + display headings |
| Open Graph cover | `marketing/assets/og-cover.png` | Social previews (1200×630) |
| Square logo | `marketing/assets/logo-512.png` | JSON-LD logo source |

`marketing/brand-assets.html` is the render source for the two PNG rasters and is
current with the chosen mark. **Both PNGs still need regenerating by hand:** serve
it (`npm run marketing` → `/brand-assets`), then screenshot the `#og` block at
1200×630 into `marketing/assets/og-cover.png` and the `#logo` block at 512×512
into `marketing/assets/logo-512.png`. Re-screenshot after any change to the mark.

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
