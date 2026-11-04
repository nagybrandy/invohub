# Redesign 2026-11: exact design values

Lifted from the CSS embedded in the designer's prototype
(`invohub-preview-standalone.html`, kept outside the repo at
`/private/tmp/claude-501/-Users-brandy--claude-spares-spare-EREtU4/8488808b-15d5-423e-98ec-f4fc5730599d/scratchpad/design/invohub-preview-standalone.html`).
These are values only. The prototype markup and scripts are not code to copy.
`SPEC.md` says how each value maps onto this codebase.

Where the prototype has two values for the same thing (it was built from
several parts), the **normalised** column says which one we build. The
brief (`BRIEF.md`) wins over the CSS when they disagree, for example
"inputs 42px high".

## 1. Colour tokens

Every colour in a component comes from one of these. Hex values are exact.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--canvas` | `#F6F6F8` | `#0A0D12` | page background behind cards |
| `--surface` | `#FFFFFF` | `#171A20` | cards, top bar, tab bar, inputs, popovers |
| `--line` | `#E6E8EC` | `#262A33` | row dividers, card inner borders, top bar bottom border |
| `--line-strong` | `#C5C7CA` | `#3A3F4B` | input, button and chip outlines, popover border |
| `--ink` | `#212325` | `#E7E9ED` | primary text |
| `--muted` | `#5B5D61` | `#A0A6B2` | secondary text, helper text, table header text |
| `--faint` | `#8A8D92` | `#7B8190` | placeholders, disabled, decorative separators only (3.33:1 on white: never for readable text) |
| `--primary` | `#3F6BC4` | `#5A85E0` | primary button fill, links, focus ring, active tab |
| `--primary-press` | `#335AA8` | `#4C74CB` | primary hover/pressed |
| `--primary-ink` | `#1F305E` | `#CFDDFB` | text on `--primary-wash`; light-mode active segment fill |
| `--primary-wash` | `#E6EEFC` | `#1B2745` | selected row/menu item, "Fizetésre vár" pill, info notes |
| `--primary-line` | `#BFD0F2` | `#2F4A85` | outline of placeholder chips |
| `--ok` | `#1B7A4F` | `#4CC38A` | paid, NAV accepted tick |
| `--ok-wash` | `#E1F4EA` | `#12301F` | "Fizetve" pill background |
| `--warn` | `#8A5200` | `#F0B35A` | partly paid, "N napja" overdue age |
| `--warn-wash` | `#FFF1D1` | `#33260D` | "Részben fizetve" pill, warning notes |
| `--err` | `#C62828` | `#F26B6B` | overdue, NAV error, destructive |
| `--err-wash` | `#FDECEC` | `#3A1A1C` | "Lejárt" pill, error banner |
| `--err-line` | `#E7B4B4` | `#6B2B2E` | outline of the critical next-step card, danger button border |
| `--neutral-wash` | `#EEF0F4` | `#222630` | "Piszkozat" pill, hover on ghost controls, icon circles |
| `--wash2` | `#FAFBFD` | `#1C1F26` | table header row, hover row, footer strips |
| `--navy` | `#131F4A` | `#0B1230` | sidebar background, tooltip and toast background |
| `--navy-2` | (not set) | `#151F4A` | reserved |
| `--navy-ink` | `#C9D3F0` | (not overridden) | sidebar text and icons |
| `--backdrop` | `#E6E9F0` | `#0A0C10` | prototype frame background (not used in app) |

Segmented control tokens:

| Token | Light | Dark |
|---|---|---|
| `--seg-track` | `#FFFFFF` | `#1E2229` |
| `--seg-active` | `#1F305E` | `#5A85E0` |
| `--seg-active-ink` | `#F6F6F8` | `#FFFFFF` |
| `--seg-ink` | `#212325` | `#E7E9ED` |
| `--seg-hover` | `#F2F5FB` | `#262B35` |
| `--seg-line` | `#C5C7CA` | `#3A3F4B` |

Fixed colours (same in both themes):

- Sidebar: background `--navy`; text `--navy-ink`; active row background `rgba(255,255,255,.10)` and text `#FFFFFF`; hover `rgba(255,255,255,.11)`; divider `rgba(255,255,255,.12)`; logo tile `linear-gradient(135deg,#6C93E8,var(--primary))`, 26x26, radius 7.
- Scrims: modal and sheet `rgba(10,16,40,.50)`; tab-bar sheets `rgba(10,16,40,.45)`; notification scrim (phone) `rgba(19,31,74,.35)`.
- Invoice paper (PDF preview): white `#FFFFFF`, text `#1B1D20`/`#222`, in both themes.
- Search highlight `mark`: `#FFF1B8`.

Theme selectors (exactly this shape):

```css
:root { /* light values */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* dark values */ color-scheme: dark; }
}
:root[data-theme="dark"] { /* dark values */ color-scheme: dark; }
```

## 2. Measured contrast (WCAG, computed from the values above)

| Pair | Ratio | Verdict |
|---|---|---|
| white on `--primary` light `#3F6BC4` | 5.11 | AA |
| white on `--primary` dark `#5A85E0` | 3.58 | **fails AA for 14px text** (see SPEC open questions) |
| `--seg-active-ink` on `--seg-active` light | 11.84 | AA |
| `--muted` on `--surface` light | 6.60 | AA |
| `--muted` on `--canvas` light | 6.11 | AA |
| `--faint` on white | 3.33 | placeholder/decorative only |
| `--faint` on `--surface` dark | 4.47 | placeholder/decorative only |
| `--err` on `--err-wash` light | 4.92 | AA |
| `--ok` on `--ok-wash` light | 4.65 | AA |
| `--warn` on `--warn-wash` light | 5.70 | AA |
| `--primary-ink` on `--primary-wash` light | 10.96 | AA |
| `--navy-ink` on `--navy` | 10.63 | AA |
| `--primary` light on `--canvas` (links) | 4.73 | AA |
| `--primary` dark on `--surface` dark (links) | 4.87 | AA |

## 3. Typography

Fonts: headings **Stack Sans Notch**, body and numbers **Stack Sans Text**
(both variable, weight 200 to 700, OFL-1.1, Google Fonts). Stacks:

- `--head: "Stack Sans Notch","Stack Sans Text",system-ui,-apple-system,"Segoe UI",sans-serif`
- `--body: "Stack Sans Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`

Base: `body { font: 14px/1.45 var(--body); -webkit-font-smoothing: antialiased }`.

| Role | Size / weight / line-height | Family | Phone (<=700) |
|---|---|---|---|
| Page title (h1) | 26 / 700 / 1.1, letter-spacing -0.01em | head | 22 |
| Page lead / subtitle | 14 / 400, `--muted` | body | 13 |
| Section / card title (h2) | 16 / 700 / 1.2 | head | 15 |
| Settings row label (`.slab h2`) | 15 / 600 / 1.3 | body | 15 |
| Row / card item title | 15 / 600 / 1.3 | body | 15 |
| Body | 14 / 400 / 1.45 | body | 14 |
| Helper / meta / table header | 13 / 400-500 | body | 13 |
| Micro (badges, chips, group labels) | 12 / 400-600 | body | 12 |
| Tab bar label | 11 / 600 | body | 11 |
| Hero number (Kintlévőség) | 30 / 700 / 1.1, -0.01em | body | 26 |
| KPI number (stat card) | 20 / 700 / 1.15 | body | 18 |
| KPI strip value (Számlák) | 20 / 700 / 1.2 | head | 17 |
| Gross total (composer) | 22 / 700 / 1 | body | 22 |
| Currency unit after a number (`Ft`) | 0.58em / 500, `--muted` | body | same |
| Group label (notifications "TEENDŐK") | 12 / 600, uppercase, letter-spacing .05em, `--muted` | body | same |

Money is always `font-variant-numeric: tabular-nums`, `white-space: nowrap`.
In data lists only the amount is bold (700); partner, number, date and
pills are regular (400); unselected tabs are regular, the selected tab 600.

## 4. Radii, shadows, spacing

| Token | Value |
|---|---|
| `--r` (cards, panels) | 12px |
| controls (buttons, inputs, selects, nav rows, menu items) | 8px |
| chips / pills / toggles | 99px (status pills use 6px, see 6.4) |
| popovers / menus | 10-12px (normalised: 12px) |
| modal dialog | 16px |
| bottom sheet | 18-20px top corners (normalised: 18px) |
| `--shadow` light | `0 1px 2px rgba(19,31,74,.06), 0 6px 22px rgba(19,31,74,.06)` |
| `--shadow` dark | `0 1px 2px rgba(0,0,0,.4), 0 6px 22px rgba(0,0,0,.35)` |
| popover shadow | `0 14px 40px rgba(19,31,74,.22)` (menus), `0 16px 44px rgba(19,31,74,.28)` (create menu) |
| notifications panel shadow | `0 18px 50px rgba(19,31,74,.28), 0 0 0 1px var(--line)` |
| modal shadow | `0 20px 60px rgba(10,16,40,.4)` |
| sheet shadow | `0 -10px 40px rgba(19,31,74,.3)` |
| tooltip shadow | `0 6px 18px rgba(19,31,74,.3)` |

Spacing: page padding 24px (16px at <=900px), page bottom padding 90px
(128px on phone, room for the tab bar). Card padding 20px 22px. Grid gaps
16px (12px between stacked stat cards on phone, 14px between next-step
cards). Settings section padding 22px 24px.

Containers: dashboard and lists `max-width: 1160px`; settings `1120px`;
composer `1240px`.

## 5. Focus, motion

- Focus ring: `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }`.
  Inputs: `outline: 2px solid var(--primary); outline-offset: 0; border-color: var(--primary)`.
  On navy (sidebar) the outline colour is `#FFFFFF`; the split button uses
  `outline: 2px solid #fff; outline-offset: -3px`.
- `@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important } }`.
- Transitions: sidebar width `.22s ease`; sheets `transform .26s ease`;
  toggles `.15s`; dismissed list items `opacity .3s`.

## 6. Components

### 6.1 Segmented control (`.ihseg`)
- Track: `display:flex; gap:4px; padding:4px; width:100%; max-width:520px; background:var(--seg-track); border-radius:12px`.
  On a white card: `box-shadow: inset 0 0 0 1px var(--seg-line)`.
- Segment: `flex:1 1 0; height:36px; padding:0 12px; border-radius:8px; font: 400 14px/1.3 var(--body); color:var(--seg-ink)`; ellipsis.
- Hover (not active): `background:var(--seg-hover)`.
- Active (`aria-checked=true`): `background:var(--seg-active); color:var(--seg-active-ink); font-weight:500`.
- Disabled: `opacity:.45`.
- Compact `.sm`: height 30px, radius 10px track / 7px segment, 13px text, wraps.
- <=520px: labels wrap (`white-space:normal; min-height:36px; padding:8px`).
- Full-width variant (composer type switch): `max-width:none`, `box-shadow: inset 0 0 0 1px var(--line)`.

### 6.2 Buttons

| Variant | Height | Padding | Style |
|---|---|---|---|
| primary | 40 (lists, composer), 42 (settings forms) | 0 16px | `--primary` fill, white 600 text, hover `--primary-press`, radius 8 |
| secondary | same | 0 16px | `--surface` fill, 1px `--line-strong` border, `--ink` 600, hover `--wash2`/`--neutral-wash` |
| tertiary (text) | same | 0 10px | transparent, `--primary` 600, hover `--neutral-wash` (or `--primary-wash`) |
| danger | 42 | 0 16px | outline: `--err` text, `--err-line` border, hover `--err-wash`; solid: `--err` fill, white text |
| small | 32-34 | 0 12px | 13px text |
| large | 46 | 0 22px | dashboard CTA |
| card action | 40 | flex:1 | next-step cards |
| icon button | 34x34 (40x40 on phone) | 0 | transparent, `--muted` icon, hover `--neutral-wash` + `--ink` |

Normalised: one `Button` with `variant: primary | secondary | tertiary | danger | dangerSolid` and `size: sm(34) | md(40) | lg(46)`; form pages use `md` but forms rows align at 42 via `size="form"` (42). Text link (`.tlink`): no padding box, `--primary` 600, underline on hover.

### 6.3 Inputs and selects
- Height **42px** (normalised; composer line-item cells 38px), `border:1px solid var(--line-strong); border-radius:8px; background:var(--surface); padding:0 12px; color:var(--ink)`.
- Textarea: `min-height:90px; padding:10px 12px`.
- Focus: 2px `--primary` outline, offset 0, border `--primary`.
- Invalid: border `--err` (composer also `background:var(--err-wash)`); error text 13px 600 `--err`, 5px above.
- Disabled: `background:var(--wash2); color:var(--faint)`.
- Label: 600 (settings) / 13px 500 (composer), 6px below; helper 13px `--muted`, 5px above.
- Select chevron: 12px stroke `#5B5D61` 1.6, right 12px.
- Search field: 40px high (top-bar global search 36px), left icon at 12px in `--faint`, text inset 36px.

### 6.4 Pills, chips, badges
- Status pill (`.iv-b`): `display:inline-block; border-radius:6px; padding:2px 9px; font:400 12px; white-space:nowrap`.

  | Status | Background | Text | HU label |
  |---|---|---|---|
  | paid | `--ok-wash` | `--ok` | Fizetve |
  | overdue | `--err-wash` | `--err` | Lejárt |
  | waiting (sent/unpaid) | `--primary-wash` | `--primary-ink` | Fizetésre vár |
  | partly paid | `--warn-wash` | `--warn` | Részben fizetve |
  | draft, proforma, storno, cancelled | `--neutral-wash` | `--muted` | Piszkozat / Díjbekérő / Sztornó / Érvénytelenített |
- Settings pill (`.pill`): radius 99, `3px 10px`, 12px 600, neutral/ok/warn variants.
- Filter chip (sheet): `border:1px solid var(--line-strong); border-radius:99px; padding:7px 14px; font-weight:500`; count in `--muted` after 4px. Pressed: `--primary-ink` fill and border, white 600 text.
- Composer quick chip: `1px solid var(--line-strong); radius 99; padding 3px 11px; 13px 500`. Pressed: `--primary-wash` fill, `--primary` border, `--primary-ink` 600.
- Quick-add product chip: dashed `--line-strong` border, radius 99, `3px 11px`, 13px.
- Active-filter chip (list toolbar): 32px high, radius 99, `--primary-wash` / `--primary-ink`, 13px 600, x button 20px circle.
- Count badge (next steps): `--err` fill, white 12px 700, radius 99, `1px 8px`; zero state `--ok`.
- Bell badge: `--err`, white 10px, radius 99, `1px 5px`, top-right of the 34px bell.
- Filter count (`.iv-n`): 18px high, min-width 18, radius 9, `--primary` fill, white 11px 700.

### 6.5 NAV state icon
- Error: outlined red warning triangle, `--err`, in a 30x30 button (radius 8, hover `--err-wash`). Column width 56px, centred. Tooltip on hover/focus carries the NAV reason text, background `--primary-ink`, white 12px/1.4, `padding:7px 10px`, radius 8, max-width 260px.
- Accepted: check icon in `--ok` at 55% opacity.
- Not submitted / not applicable: empty cell.

### 6.6 Data table (`.ivt`)
- Card: `--surface`, radius `0 0 12px 12px` when tabs sit on top (12px otherwise), `--shadow`, overflow hidden.
- Header: sticky, `background:var(--wash2)`, 13px 500 `--muted`, `padding:10px`, bottom border `--line`. Sortable header = button with arrow icon; sorted header in `--ink`.
- Row: height 56px, `padding:8px 10px`, bottom border `--line`, pointer, hover `--wash2` on cells.
- Number cell: regular weight, second line 12px `--muted` (document type, "N nap múlva", "Lejárt N napja" in `--err` 12px).
- Amount: 700, right aligned, tabular, nowrap.
- Row menu button: 34x34 icon button with vertical dots, last column.
- Columns (Számlák): Sorszám, Partner (27%), Kelt, Fizetési határidő, Státusz (header opens multi-select popover), NAV (56px), Bruttó összeg (15%, right), menu. No checkbox column.
- Footer: `padding:12px 16px; border-top:1px solid var(--line); background:var(--wash2); color:var(--muted)`; totals in `--ink` tabular.

### 6.7 Cards list (narrow, <=820px container)
- Row: `padding:12px 14px`, grid `minmax(0,1fr) auto`, gap `2px 10px`, divider `--line`.
- Line 1: partner (400, ellipsis) and amount (700, right). Line 2: `number · date` 13px `--muted`. Line 3: status pill (+ NAV icon, + "Lejárt N napja" in `--err`) and the row-menu button right.

### 6.8 KPI strip (Számlák)
- One card, `display:grid; grid-template-columns:repeat(4,minmax(0,1fr))`, cells separated by 1px `--line`, each cell a button `padding:14px 18px`, hover `--wash2`.
- Cell: label (`--muted` 500), value (20/700 head, tabular), sub (13px `--muted`). Lejárt value `--err`, Fizetve value `--ok`.
- <=820px container: 2 columns, cell padding `12px 14px`, value 17px.

### 6.9 Tabs (underline)
- `display:flex; gap:22px; border-bottom:1px solid var(--line-strong)`; tab `padding:10px 2px; border-bottom:2px solid transparent; margin-bottom:-1px; color:var(--muted)`.
- Selected: `color:var(--primary-ink); border-bottom-color:var(--primary); font-weight:600`. Count after 6px, `--faint`; selected count `--primary`; the Lejárt count `--err`.

### 6.10 Sidebar
- Width 248px expanded, 72px collapsed (`grid-template-columns` transition .22s). Padding `16px 12px` (`16px 10px` collapsed).
- Head: logo (26px tile + "InvoHub" 700 18px head, white) and a 36x36 collapse icon button at the right; collapsed: stacked and centred.
- Split create button: 42px high, radius 10, `--primary` fill; main part `padding:0 14px`, "+" icon + "Új számla" 600 white; arrow part 38px wide with `border-left:1px solid rgba(255,255,255,.28)`; hover `rgba(255,255,255,.14)`; collapsed: 44px square, arrow hidden. Margin-bottom 14px.
- Nav row: `display:flex; gap:12px; padding:9px 12px; border-radius:8px; font-weight:500; color:var(--navy-ink)`; icon 18px at 85% opacity; active `background:rgba(255,255,255,.1); color:#fff`. Collapsed: centred, `padding:11px 0`. Divider: `border-top:1px solid rgba(255,255,255,.12); margin:10px 4px`.
- Footer (org/account button): `padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06)`; avatar 32x32 radius 8 `--primary` with 12px 700 initials; name 14px 600 white ellipsis; tax number 12px `--navy-ink` 80%; chevron-up-down at 70%. Footer separated by `border-top:1px solid rgba(255,255,255,.12)`, `padding-top:10px`.
- Account menu (popover above the footer): width 272px, radius 12, padding 6, shadow `0 14px 40px rgba(19,31,74,.25)`. Sections: "Bejelentkezve" (12px `--muted`) with user avatar (32px circle, `--navy`) + name + e-mail; divider; "Cégeid" list (avatar, name, tax number, check on active, active row `--primary-wash`); divider; "+ Cég hozzáadása", "Cégadatok szerkesztése" (600 `--primary-ink`); divider; "Kijelentkezés" with log-out icon (500).

### 6.11 Top bar
- Height 56px, `--surface`, bottom border `--line`, `padding:0 20px` (`0 12px` on phone), gap 12px. **No page title.**
- Right side: global search (`width:min(340px,32vw); min-width:190px; height:36px; border:1px solid var(--line-strong); radius 8; padding 0 8px 0 10px`, search icon `--muted`, placeholder "Keresés" `--faint`, no keyboard hint) then the bell (34x34, radius 8, hover/expanded `--neutral-wash`, badge as 6.4).
- Phone: account button on the left (`height:42px; padding:4px 10px 4px 5px; border:1px solid var(--line); radius 10`, avatar 32px, name 14px 600 ellipsis, chevron `--muted`; expanded border `--primary`), search icon button (40x40) and bell on the right. Tapping search turns the bar into a full-width search field.
- Search results popover: `width:min(460px,100vw - 16px)`, radius 12, padding 6, `max-height:min(70vh,520px)`; group headings 12px 600 `--muted`; result row `padding:9px 10px; radius 8; gap 12`, icon `--muted`, title 400 ellipsis, sub 13px `--muted`, amount 700 tabular right; selected/hover `--neutral-wash`; match `mark` `#FFF1B8`.

### 6.12 Phone tab bar (<=700px)
- Fixed bottom, `--surface`, top border `--line`, shadow `0 -4px 18px rgba(19,31,74,.06)`, `padding:6px 4px calc(6px + env(safe-area-inset-bottom))`.
- `grid-template-columns: 1fr 1fr 1.45fr 1fr 1fr` (equal visual spacing between the five shapes).
- Tab: min-height 52px, column flex, gap 3px, icon 24px, label 11px 600 `--muted`; active `--primary`; pressed `--neutral-wash` radius 10.
- Centre "Új": pill 56x32 radius 16 `--primary` fill, white "+" 20px, shadow `0 2px 8px rgba(63,107,196,.35)`, pressed `--primary-press` scale .94; label "Új" in `--primary` below.
- Order: Főoldal, Számlák, Új, Partnerek, Továbbiak.

### 6.13 Sheets and modals
- Bottom sheet (<=700px): fixed bottom, `--surface`, radius `18px 18px 0 0` (20 for the tab-bar sheets), `padding:8px 16px calc(14px + env(safe-area-inset-bottom))`, `max-height:88vh`, slide-up `transform .26s`. Grab handle 40x4 radius 2 `--line-strong`, margin `4px auto 6px`. Header row: title 16px 700 head, close button 38x38 circle `--neutral-wash` (or 36x36 transparent in the filter sheet). Sheet rows: min-height 52px, gap 14, icon 22px `--muted`, 14px 500.
- Centred dialog (>700px): `width:min(460px,calc(100% - 32px))`, radius 16, `max-height:calc(100% - 48px)`, header `padding:18px 20px 8px`, body `padding:4px 20px 12px; gap:18px`, footer `padding:12px 20px 18px; border-top:1px solid var(--line)`.
- Confirm modal (logout): `width:min(400px,100%)`, radius 16, padding 24; icon circle 44px `--err-wash`/`--err`; title 16 700 head; text `--muted`; actions right-aligned gap 10 (phone: bottom sheet, actions stacked full-width, primary on top).
- Scrim closes on click; Esc closes; focus trapped inside and returned to the trigger.

### 6.14 Popover menus
- Row menu (`#ivMenu`): min-width 230px, `--surface`, `1px solid var(--line-strong)`, radius 10, padding 6, shadow `0 14px 40px rgba(19,31,74,.2)`. Item: `padding:12px 14px; gap:14px; radius 8; 14px 500`; icon `--muted`; hover/focus `--neutral-wash`. Destructive item: `--err` text and icon. Max five actions.
- Status filter popover: same box; rows are checkbox labels (`padding:9px 12px`, 18px checkbox `accent-color:var(--primary)`, label, count `--faint` 13px tabular), footer with a reset button.
- Create menu (`#newMenu`): min-width 230px, radius 12, shadow `0 16px 44px rgba(19,31,74,.28)`, item `padding:11px 12px`. Items: Új számla, Új nyugta, divider, Új partner.

### 6.15 Notifications panel
- Desktop popover: fixed `top:62px; right:16px; width:420px; max-height:min(680px,100vh - 80px)`, radius 14, shadow 6.x. Phone: sheet from `top:64px` to bottom, radius `18px 18px 0 0`, with scrim.
- One **18px** horizontal inset for header, tabs, group labels and rows.
- Header: "Értesítések" 16/700 head; "Mind olvasott" tertiary with check icon (disabled `--faint`).
- Tabs: segmented control (Összes / Olvasatlan (n)), full width.
- Group label: 12px 600 uppercase `--muted`, `padding:14px 18px 8px`.
- Item: grid `36px 1fr`, gap 12, `padding:14px 18px`, top border `--line`, hover `--wash2`; icon circle 36px (crit `--err-wash`/`--err`, warn `--warn-wash`/`--warn`, low `--neutral-wash`/`--muted`, done `--ok-wash`/`--ok`, info `--primary-wash`/`--primary`); title 600/1.35; body 13px `--muted`; time 12px `--muted`; inline action row (34px buttons) 10px below. Unread dot 8px at `right:18px; top:19px`, `--primary` (to-dos `--err`).
- Empty: centred, 44px ok icon circle, "Minden elintézve".

### 6.16 Dashboard pieces
- Grid >=1100px: `minmax(0,1.55fr) minmax(0,1fr)`, areas `"hero stack" "todo todo" "recent recent"`, gap 16; stack = two rows `1fr 1fr` gap 16 (together as tall as the hero card). <1100px: one column, stack becomes two columns side by side.
- Kintlévőség card: header (h2 + small "mai állapot, date" 12px `--muted`), hero number, sub 13px `--muted`; split bar 16px high, gap 3px, left `--primary` radius `8px 3px 3px 8px`, right `--err` radius `3px 8px 8px 3px`, min segment width 10px, segments are buttons (hover brightness .92); legend rows with 9px dots, 600 amount, small `--muted` count.
- Stat card: `padding:14px 22px`, label 13px `--muted` 500 (+ 20px circular info button), number 20/700, period 13px `--muted`.
- Next-step cards: `grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:14px`; card `padding:18px 20px; gap:12px`; critical card `box-shadow:0 0 0 1.5px var(--err-line), var(--shadow)`; header icon circle 30px (crit: bare 22px triangle) + label (crit `--err` 600); title 15/600; per-bill row `padding:6px 8px; margin:0 -8px; radius 8`, 13px, amount 700 tabular, age in `--warn` 12px; 30px mini icon button per bill; card actions at the bottom, buttons 40px flex:1.
- Header "Következő lépések" with a count badge.
- Recent invoices: title row outside the box ("Legutóbbi számlák" + "Összes" tertiary link), inside only the table (same columns as Számlák, no sticky/wash header, no shadow on the inner list card).

### 6.17 Settings layout
- Settings view is a container: <860px one column with a back link ("‹ Beállítások"); >=860px two columns `240px minmax(0,1fr)`, gap 32, left nav sticky at top 24px.
- Left nav: search field (40px, radius 10) on top; rows `padding:9px 10px; gap:10px; radius 8; 500`; 18px icon `--muted` in a 20px box; current row `--primary-wash` / `--primary-ink` 600 with icon `--primary`; divider `--line-strong` before API kulcsok; warn dot 8px `--warn` for pages that need attention.
- Page: h1 26/700 head, lead 14px `--muted` max 62ch, margin `8px 0 20px`.
- Sheet card: `--surface`, radius 12, shadow; sections `padding:22px 24px`, divided by `--line`; section grid one column, at sheet width >=640px `minmax(170px,.75fr) minmax(0,1.6fr)` gap 36. Left: label 15/600 + hint 13px `--muted`. Right: controls, fields max 520px.
- Switch: 44x26 radius 99, off `--line-strong`, on `--primary`, knob 20px `--surface`, shadow `0 1px 3px rgba(0,0,0,.3)`, travel 18px.
- Save bar: sticky bottom, `--surface`, top border `--line-strong`, shadow `0 -6px 20px rgba(19,31,74,.08)`, inner `max-width:1120px; padding:12px 24px`, unsaved label left, buttons right (phone: full-width buttons, label hidden).
- Start page (phone): groups of rows (`.orow`: grid `36px 1fr auto 18px`, `padding:14px 16px`, icon tile 36px radius 9 `--primary-wash`/`--primary`, title 600, description `--muted`, chevron `--faint`). Logout row last, in its own card, icon tile `--err-wash`/`--err`.
- Theme cards: three columns gap 12; card `padding:8px 8px 12px; border:1.5px solid var(--line-strong); radius 12`; selected border `--primary` + `0 0 0 1px var(--primary)` + 16px check circle; preview 78px high radius 8 with mini sidebar (22%), bar and card shapes; narrow pane (<=520px): one column, row layout with 84x56 preview.
- E-mail templates: list 200px beside the editor at pane >=720px, dropdown below that; editor field with an attached toolbar (`--wash2` bar, 34x32 buttons) and placeholder chips (`--primary-wash`, `--primary-line` border, radius 6, 600 .92em); insert chips dashed `--primary-line`, `--wash2`, radius 99.
- Invoice customisation: form + preview at pane >=760px (`minmax(0,1fr) minmax(390px,50%)`, preview sticky); below that a "Előnézet" toggle button reveals the preview above the form. Preview frame `--neutral-wash` radius 14 padding 12, paper white.

### 6.18 Composer (Új számla / Új nyugta)
- Page `max-width:1240px; padding:16px 24px 40px`. Breadcrumb 13px `--muted` (current item `--ink` 500). Sticky action bar: h1 26/700 (21 on phone) + "Előnézet" secondary button (38px, icon + label; label hidden on phone).
- Type switch: full-width segmented control (Számla / Díjbekérő / Előlegszámla).
- Sections divided by `--line`, `padding:22px 0`, h2 16/700 head.
- Terms summary card: border `--line-strong` radius 12; cells `padding:11px 14px` with 12px `--muted` label and 600 value, separated by `--line`; footer strip `--wash2` with the reason text and "Módosítás" link; edit mode is a two-column grid (one column on phone) with quick chips.
- Line items: name full width, then Menny. (72), Egység (84), Egységár (112), ÁFA (112), Összesen (128, right), delete (34) on one labelled line; at container >=820px one row with a header line (12px `--muted`); <480px the total moves to its own line with a dashed top border. No row numbers. Cells 38px high.
- Totals: right-aligned block max 340px; gross row 22/700 above a `--line-strong` rule.
- Bottom bar (sticky): net and gross summary left; "Piszkozat mentése" secondary and the primary action right.
- Collapsible "További beállítások" card with chevron, closed by default.
- Preview: closed by default; >=1100px opens as a side column (420px); narrower opens as a sheet from `top:96px`.
