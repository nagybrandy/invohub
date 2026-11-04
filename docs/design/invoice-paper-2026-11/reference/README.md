# Reference screenshots (Dóri's 2026-11 invoice paper)

Captured 2026-11-03 with Playwright (Chrome, device scale 2) from the designer's
prototype `invohub-preview-standalone.html`, Beállítások > Számla testreszabása.
Each `settings-*.png` is the paper element only, rendered unscaled (560 x 790 CSS px),
with the prototype's mock data. Unless the name says otherwise the options are
Dóri's defaults: Keretes, InvoHub font, Monogram M left, #3F6BC4, all toggles on.

| File pattern | What changes |
|---|---|
| `settings-layout-{letisztult,savos,keretes}-font-{invohub,klasszikus,kerek}.png` | Elrendezés x Betűstílus matrix |
| `settings-logo-monogram-size-{S,M,L}-left.png`, `…-M-right.png` | Monogram size and position |
| `settings-logo-own-placeholder-M-left.png` | Saját logó before a file is chosen |
| `settings-logo-own-size-{S,M,L}-left.png`, `…-M-right.png` | Saját logó with a sample PNG-like logo (wide 3:1 SVG) |
| `settings-logo-none.png` | Nincs (size/position controls disappear) |
| `settings-color-*.png` | each swatch, plus custom #F2B705 darkened to #8e6b03 |
| `settings-toggle-*-off.png`, `settings-toggles-all-off.png` | Megjelenő adatok switches (see PLAN.md 6: not all allowed) |
| `settings-font-custom-montserrat-opensans.png` | Saját párosítás default (left out of this slice) |
| `new-invoice-preview-draft.png` | Új számla > Előnézet paper (draft watermark; not canonical) |
| `context-*.png` | full-screen context: settings, Új számla with preview open, invoice detail |
| `today/today-sample-*.png` | today's generated PDF (legacy renderer), 80 dpi, for comparison |

The prototype's invoice detail embeds a placeholder PDF, so there is no detail
paper design (`context-invoice-detail-desktop.png`: "Mintaszamla (design
prototipus)" placeholder, top badge "Új keret, a tartalom még az eredeti").
