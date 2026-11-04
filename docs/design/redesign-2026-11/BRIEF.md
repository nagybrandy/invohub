# InvoHub redesign: developer brief

Audience: a developer (and the AI coding agent they use) who will apply this design to the **existing InvoHub website**. The prototype in this folder is the visual and behavioural reference, **not code to copy**. Re-implement each screen in the site's own stack and components, matching the prototype's look, copy and behaviour.

## How to use this folder
1. Open `invohub-preview-standalone.html` in a current Chrome, Edge, Firefox or Safari. One self-contained file (about 2.4 MB), no server, no network. Use the "Gyors ugrás" dropdown on top to jump to any of the 40 screens; the Asztali / Tablet / Telefon switch shows each breakpoint. Light/dark: Beállítások > Nyelv és megjelenés.
2. Read the exact CSS for any component in the source files (table below). Every colour is a CSS variable, so values are easy to lift.
3. Work in the order under "Suggested implementation order".

## What is real and what is mock
- Real design: layout, spacing, type, colour, copy, states, responsive behaviour, dark mode.
- Mock: all data (invoices, partners), NAV statuses, email sending, PDF download, log out, recurring scheduling, currency rate (MNB demo value). Replace with the real backend.
- Prototype glue to ignore: the nested iframes, `postMessage` routing, `window.__ih*` hooks, the "Mi változott?" button, the "Gyors ugrás" bar. Screens not yet redesigned (partner edit, import, onboarding, public pages, login) are shown from the first prototype inside the shell; keep the existing site's versions of those for now.

## Source map (all readable, build with `python3 build.py`)
| File | What it holds |
|---|---|
| `dash-template.html` | App shell (sidebar, top bar, phone tab bar), Főoldal, notifications panel, account menu, org switcher |
| `template.html` | Új számla / Új nyugta flow |
| `invoices-part.*` | Számlák list, KPI strip, filters, sorting, row menu, filter sheet |
| `lists-part.*` | Nyugták, Partnerek, Termékek (same pattern as Számlák) |
| `settings-part.*` | All Beállítások screens, logout row and modal, theme cards |
| `search-part.*`, `create-part.*` | Global search; split "Új számla" button and menu |
| `seg-component.css` | The one segmented control |
| `dark-tokens.css` | Dark-mode colour values |
| `stack-fonts.css` | Embedded Stack Sans fonts |
| `chrome.js.txt`, `wrapper.tpl.html`, `build.py`, `original-prototype.html` | Prototype plumbing only |

## Design tokens
Light (default). Define as CSS variables on `:root`:
`--canvas #F6F6F8, --surface #FFFFFF, --line #E6E8EC, --line-strong #C5C7CA, --ink #212325, --muted #5B5D61, --faint #8A8D92, --primary #3F6BC4, --primary-press #335AA8, --primary-ink #1F305E, --primary-wash #E6EEFC, --primary-line #BFD0F2, --ok #1B7A4F, --ok-wash #E1F4EA, --warn #8A5200, --warn-wash #FFF1D1, --err #C62828, --err-wash #FDECEC, --err-line #E7B4B4, --neutral-wash #EEF0F4, --wash2 #FAFBFD, --navy #131F4A` (sidebar), radius 12 (cards) / 8 (controls) / 99 (chips).
Dark: see `dark-tokens.css` (canvas `#0A0D12`, surface `#171A20`, primary `#5A85E0`, etc.). Apply with `@media (prefers-color-scheme: dark) { :root:not([data-theme=light]) {...} }` plus `:root[data-theme=dark] {...}`, so an explicit user choice beats the system setting. Never hard-code a colour in components; use the tokens. Exception: invoice paper (PDF preview) is white in both themes.
Fonts: headings Stack Sans Notch, body Stack Sans Text (embedded in `stack-fonts.css`; ask design for the licence/files). Optional PDF pairings: Klasszikus (Source Serif 4 / Source Sans 3), Kerek (Nunito / Nunito Sans), plus a custom pairing.

### Type scale (one scale for the whole app)
Page title 26/700 (22 on phone) · section/card title 16/700 · row/card item title 15/600 · body 14 · helper/meta 13 · micro (badges, chips) 12 · hero number 30, KPI number 20. Tabular numerals for money. Short, plain Hungarian; no jargon; helper texts one short sentence.

## Components (build once, reuse everywhere)
- **Segmented control** (`seg-component.css`): 36px high, track = surface, active = `#1F305E` with `#F6F6F8` text (dark: primary blue, white text), inactive regular weight. Use for small fixed choices (e.g. Számla / Díjbekérő / Előlegszámla, logo Monogram / Saját logó / Nincs). Use a **dropdown** for language and payment settings, and **preview cards** for the theme.
- **Split create button** ("+ Új számla ▾"): main click creates an invoice; the arrow opens Új számla / Új nyugta / Új partner. Sidebar variant collapses with the sidebar.
- **KPI strip** (Kintlévőség, Lejárt, Fizetve, ÁFA): four cells, each clickable and applying that filter on Számlák. Two columns on phone.
- **Status pill**: Piszkozat (neutral), Fizetésre vár (blue), Lejárt (red), Fizetve (green), Díjbekérő, Részben fizetve. 12px.
- **NAV state**: an outlined red warning triangle with a tooltip carrying the reason; green tick when accepted; same icon on every screen.
- **Data list**: table on desktop (sortable headers, multi-select status filter in the Státusz header, only the amount is bold, row menu limited to five actions, no checkbox column), cards on phone. Amount, partner and date are the primary scan targets.
- **Filter sheet** (phone/narrow): one "Szűrés és rendezés" button with an active-filter count opens a bottom sheet (centred dialog on wider screens): Státusz chips with counts, Időszak, Rendezés plus direction, CSV letöltés, Törlés, "Találatok megtekintése (n)". Inline period/sort/CSV controls show only on wide screens.
- **Sheet / modal**: bottom sheet on phone, centred dialog (max 460px) otherwise; scrim, Esc and outside-click close, focus returns to the trigger.
- **Notifications** (bell, badge = unread count): popover on desktop, bottom sheet on phone. Groups "Teendők" (NAV error, each overdue bill with its own reminder button, drafts; actions inline) and "Korábbi" (payments received, NAV accepted, invoice opened, reminder sent). Összes / Olvasatlan filter, "Mind olvasott" (to-dos stay until resolved), empty state "Minden elintézve". One 18px content inset for header, tabs, labels and rows.
- **Phone tab bar**: Főoldal, Számlák, **Új** (centre), Partnerek, Továbbiak. "Új" is a rounded pill (56×32) filled with the primary colour, "+" icon, label below, opens a Számla / Nyugta sheet. Spacing between the five shapes must be equal: centre column is 1.45× the others.
- **Theme and language**: language dropdown with native names (Magyar, English); theme as three cards with a mini preview (Világos, Sötét, Rendszer szerint).
- **Log out**: a normal settings row (red icon, "Kijelentkezés", "Kilépés ezen az eszközön.") as the last item, in its own card, and the last item of the account menu; always opens a confirmation modal ("Kijelentkezel?" with Mégse / Kijelentkezés).

## Screens
- **Főoldal**: header (title, one-line summary of open tasks, quarter switcher). Kintlévőség card (split bar: not due vs overdue; hugs its content), beside it Beérkezett fizetések and Becsült ÁFA (the two together are as tall as the Kintlévőség card on desktop; stacked on phone). "Következő lépések" cards (NAV error, overdue payments with per-bill reminder and "remind all", drafts). "Legutóbbi számlák": title outside the box, only the list inside, same columns as Számlák. No create buttons in the page header (sidebar and phone tab provide them).
- **Számlák / Nyugták / Partnerek / Termékek**: one pattern (see Data list). Breadcrumbs sit above the page title on subpages, not in the top bar. The top bar has no page title; it holds global search (no keyboard-hint badge) and the bell.
- **Új számla / Új nyugta**: type switch spanning the form width; partner picker with "Másolás korábbi számlából"; choosing a partner fills term, payment method, currency and language from their last invoice (EUR partner -> Angol); "Dátumok és fizetés" shown as a one-line summary with "Módosítás" (chips: Ma, Előző hó vége; 8/15/30 nap); item rows: Megnevezés full width, then Menny., Egység, Egységár, ÁFA, Összesen on one labelled line, no row numbers; preview closed by default, opened from the "Előnézet" button in the header (sheet on phone); "További beállítások" collapsed by default: Megrendelésszám, Kedvezmény %, Megjegyzés, Ismétlődő számla (+ gyakoriság); "Kiküldés és megfelelőség" has e-mail, E-számla and NAV.
- **Beállítások**: grouped navigation (Céges profil, Számlázási beállítások, Számla testreszabása, E-mailek szövege, Kiküldés és emlékeztetők, NAV, Számlázófiókok és hozzáférés, Nyelv és megjelenés, API kulcsok). Each page is one card of two-column rows (label + short helper on the left, control on the right); single column on phone. The phone start page lists only title and description per item, with Kijelentkezés last. Számla testreszabása has a live invoice preview next to the form (a toggle button reveals it when the area is narrower than about 760px); mandatory invoice fields are locked and not mentioned in copy. E-mail templates: left list of types, editor with chip placeholders and a rich-text bar attached to the field.

## Behaviour and accessibility rules
- Every control reachable by keyboard; visible focus ring (2px primary); modals trap focus and restore it; Esc closes popovers, sheets and modals.
- Touch targets 40px+ on phone. Inputs 42px high. No horizontal page scroll at 360px.
- Breakpoints: 1100 (sidebar layout, two columns), 820 (list switches to cards and filter sheet, container-based), 700 (phone: tab bar, sheets).
- Use container queries or equivalent for panes that can be narrow even on a wide screen (settings, lists).
- Respect `prefers-reduced-motion`.
- Do not reuse generic class names across features: the prototype had two bugs from colliding names (`.ni`, `.nt`).

## Suggested implementation order
1. Tokens (light + dark), fonts, type scale, global focus styles.
2. Shared components: segmented control, buttons (primary, secondary, tertiary), inputs/select, chips and pills, modal/sheet, tooltip, split button.
3. App shell: sidebar, top bar (search + bell), phone tab bar, breadcrumbs.
4. Lists (Számlák first, then Nyugták, Partnerek, Termékek) including filter sheet.
5. Főoldal, then notifications.
6. Új számla / Új nyugta.
7. Beállítások (start with the shared row layout, then each page), theme and language, logout.

## Open questions for product / finance
- Discount: whole invoice (as in prototype) or per line?
- Recurring invoices: scheduling and what the "{hónap} {év}" placeholders mean.
- Real VAT rules, 8-day issue rule and EUR rate source.
- 20 M Ft receipt limit warning for Nyugta (not in prototype).
- Sztornó and másolat exist only in the Számlák row menu, not in the new-invoice flow.
- The bell inside the Új számla page is not wired to the panel in the prototype.
- Real NAV status and error mapping; i18n (all copy is Hungarian, hard-coded).
- Formal accessibility audit has not been done.
