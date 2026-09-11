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

| Asset | Path | Use |
|-------|------|-----|
| Mark | `assets/brand/invohub-logo-mark.png` | Favicon, app icon, compact chrome |
| Lockup | `assets/brand/invohub-logo-lockup.png` | Light marketing surfaces |
| Workflow infographic | `assets/marketing/invohub-infographic-workflow.jpg` | Hero visual |
| Bento infographic | `assets/marketing/invohub-infographic-bento.jpg` | Capabilities section |

Use `BrandLogo` / `BrandMark` from `components/marketing/BrandLogo.tsx` instead of ad-hoc icon markup.
