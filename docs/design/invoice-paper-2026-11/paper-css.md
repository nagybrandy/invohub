# Invoice paper: exact CSS of Dóri's 2026-11 design

Source: the designer's self-contained prototype `invohub-preview-standalone.html`
(2026-11, "Gyors ugrás" -> Beállítások > Számla testreszabása), read from the
live DOM with Playwright (`getComputedStyle` + the stylesheet rules that
target the paper). This file is a measurement record, not code to copy: the
renderer is pdfkit (`lib/invoices/`), not HTML.

Screenshots of every variant: [`reference/`](reference/). Plan: [`PLAN.md`](PLAN.md).

## 0. Unit conversion (CSS px -> PDF pt)

The paper is designed as a **560 x 790 px** box (A4 aspect: 560 x 1.4142 = 792).
A4 is 595.28 x 841.89 pt, so the renderer uses one constant:

```
PX = 595.28 / 560 = 1.0630 pt per design px
```

Every number below is in design px; multiply by `PX` for pdfkit. Examples:
padding 34 px = 36.1 pt, body 11 px = 11.7 pt, caption 7.5 px = 8.0 pt,
title 21 px = 22.3 pt, grand total 15 px = 15.9 pt.

## 1. Canonical paper and the two other papers in the prototype

| Where | What it is | Verdict |
|---|---|---|
| Beállítások > Számla testreszabása (`#paper.pp`) | The parametrised paper: every option on the form (logo, size, position, colour, font style, layout, toggles, note label, footer) changes it live. | **Canonical.** It is Dóri's newest and most complete paper, the only one wired to the appearance model, and the screen the README names as the source of truth ("Számla testreszabása has a live invoice preview"). |
| Új számla > Előnézet (`#paper.paper`) | A fixed-style composer mock (`.paper`, 640 px wide, 8 px primary bar on top, "Piszkozat" watermark, 6-column table, `1 / 1. oldal`). It ignores every Számla testreszabása option. | **Not canonical for look.** Taken from it only: the draft watermark (see 9), and confirmation that a draft shows the page indicator and the full 6-column line table. |
| Számla részletei (invoice detail) | The prototype embeds a placeholder PDF ("Mintaszamla (design prototipus)"); the top bar badge says "Új keret, a tartalom még az eredeti" (new frame, original content). | **No paper design.** The detail keeps embedding the real generated PDF (`InvoicePdfPreview`). |

Differences between the canonical paper and the composer paper, for the record:

| Element | Számla testreszabása (canonical) | Új számla Előnézet |
|---|---|---|
| Page top | no bar; 2 px brand rule under the header | 8 px primary bar across the top edge |
| Header | logo + issuer (name, address, tax no.) left, tag + title + "Sorszám:" right | title + number left, issuer right (adds EU adószám) |
| Meta strip | 4 cells: Kiállítás kelte, Fizetési határidő, Fizetési mód, Pénznem | 4 cells: Teljesítés, Számla kelte, Fizetési határidő, Fizetési mód |
| Parties | Kibocsátó / Vevő boxes | Vevő / Fizetés |
| Table | 5 columns: Megnevezés, Menny., Egységár, ÁFA, Bruttó | 6 columns: Megnevezés, Menny., Nettó egységár, ÁFA, Nettó, Bruttó |
| Totals | Nettó összesen, ÁFA összesen, FIZETENDŐ ÖSSZESEN (2 px brand rule) | Nettó összesen, ÁFA per rate, Fizetendő (1.5 px ink rule) |
| Bank | separate strip: Bankszámlaszám + Fizetési határidő | inside "Fizetés" party column |
| Draft | n/a (sample is "KIÁLLÍTVA") | rotated "Piszkozat" watermark |
| Footer | footer text left, "Készült az InvoHub-bal · invohub.hu" right | "Az ÁFA-t az adatok alapján számoltuk." left, page indicator right |

Both prototype papers omit mandatory content the real document prints today
(teljesítés kelte on the canonical one, the ÁFA-összesítő, the Nettó line
column on the canonical one, árfolyam / ÁFA forintban, AAM/TAM/FAD texts,
storno/helyesbítő reference). The plan keeps all of it and styles it with the
canonical paper's vocabulary (PLAN.md section 4).

## 2. Paper box

```css
.pp {
  width: 560px; min-height: 790px;
  background: #fff; color: #222;
  font: 11px/1.4 var(--bf);           /* body font, 400 */
  padding: 34px 34px 20px;             /* top, sides, bottom */
  display: flex; flex-direction: column; gap: 12px;   /* 12 px between every block */
  position: relative;
}
.pp .hd { font-family: var(--hf); }     /* heading font: title, captions, table header */
.pp small { display: block; color: #666; font-size: 9.5px; }   /* line-height 13.3px */
.pp .r { text-align: right; }
```

Paper-relative block boxes (x, y, w, h in px) measured with the default sample
(3 lines, all toggles on, logo Monogram M left):

| Block | Letisztult | Sávos | Keretes |
|---|---|---|---|
| header `.ph1` | 34,34,492,58 | 34,34,492,58 | 34,34,492,58 |
| rule | 34,104,492,2 | 34,104,492,2 | 34,104,492,2 |
| meta | 34,118,492,43 | 34,118,492,42 | 34,118,492,44 |
| parties `.pty` | 34,173,492,84 | 34,172,492,83 | 34,174,492,85 |
| items `.pit` | 34,269,492,104 | 34,267,492,103 | 34,271,492,103 |
| totals `.ptot` | 255,385,271,67 | 255,382,271,67 | 255,386,271,67 |
| bank `.pbank` | 34,464,492,45 | 34,461,492,44 | 34,465,492,46 |
| note `.pnote` | 34,521,492,29 | 34,517,492,29 | 34,523,492,29 |
| footer `.pfoot` | 34,748,492,22 | 34,748,492,22 | 34,748,492,22 |

Content width = 560 - 2 x 34 = **492 px** (523 pt). The footer is pinned to the
bottom (`margin-top: auto`): its top edge sits at 748 px, i.e. 42 px above the
paper's bottom edge (20 px padding + 22 px footer).

## 3. Colour tokens (set per paper from the chosen brand colour)

```
--bc   = brand colour as chosen (swatch or custom hex)
--bd   = darkOf(--bc): the brand colour darkened until it reaches 4.5:1 contrast on white
--tint = rgba(--bc, 0.12)    (built from the ORIGINAL colour, not the darkened one)
--line = #E6E8EC             (the paper is always white, also in dark mode)
```

`darkOf(h)`: if `contrast(h) >= 4.5` return `h`; otherwise convert to HSL and
lower L by 0.02 per step (keeping H and S) until the contrast reaches 4.5 or
L <= 0.05. `contrast(h) = 1.05 / (relativeLuminance(h) + 0.05)` with the WCAG
sRGB luminance (0.03928 / 12.92 / 2.4 formula). The settings form shows a note
when `--bd != --bc`: "Fejlécben ezt a sötétebb árnyalatot használjuk: <hex> (az
olvashatóságért)."

Test vectors taken from the prototype itself:

| Chosen | `--bd` | `--tint` |
|---|---|---|
| #3F6BC4 (default swatch) | #3f6bc4 | rgba(63,107,196,.12) |
| #16803C (swatch) | #16803c | rgba(22,128,60,.12) |
| #E8590C (swatch) | #cb4e0a | rgba(232,89,12,.12) |
| #212325 (swatch) | #212325 | rgba(33,35,37,.12) |
| #F2B705 (custom) | #8e6b03 | rgba(242,183,5,.12) |
| #FFFFFF (custom) | #757575 | rgba(255,255,255,.12) |
| #00C2FF (custom) | #007ca3 | rgba(0,194,255,.12) |
| #E91E63 (custom) | #e6175d | rgba(233,30,99,.12) |

Swatches, in order: `#3F6BC4`, `#16803C`, `#E8590C`, `#212325`, then a rainbow
"Egyedi szín" button that opens a picker (saturation/value square, hue slider,
eyedropper, Hex field). pdfkit has no rgba: `--tint` on white = `mix(--bc, #fff, 0.12)`
(`tint(bc, 0.88)` in `lib/invoices/pdf-layout.ts`).

Fixed inks on the paper: body `#222`, small/secondary `#666`, captions `#555`,
note text `#333`, totals labels `#444`, grand total `#111`, row rule `#EEE`,
footer rule `#E5E6EA`, footer text `#555`, attribution `#888`, status tag
background `#EEF0F4` / text `#555`.

## 4. Fonts

```css
.f-invohub { --hf: "Stack Sans Notch";  --bf: "Stack Sans Text"; }
.f-classic { --hf: "Source Serif 4";    --bf: "Source Sans 3"; }
.f-round   { --hf: "Nunito";            --bf: "Nunito Sans"; }
.f-custom  { --hf: <chosen>; --bf: <chosen>; }   /* "Saját párosítás", Google Fonts list */
```

Weights actually used on the paper (computed styles):

| Element | Font | Weight | Size |
|---|---|---|---|
| title (`.tt .hd`, "SZÁMLA") | heading | 700 | 21 px, letter-spacing .01em, colour `--bd` |
| captions (`i.hd`) | heading | 600 | 7.5 px, letter-spacing .07em (0.525 px), uppercase text, `#555`, margin-bottom 2 px |
| table header (`th.hd`) | heading | 500 | 8 px, letter-spacing .05em, uppercase text |
| everything else | body | 400 / 700 (`<b>`) | see each block |

"Saját párosítás" offers: Stack Sans Notch, Stack Sans Text; Groteszk: Inter,
Roboto, Open Sans, Lato, Montserrat, Poppins, Work Sans, DM Sans, Manrope,
Rubik, Fira Sans, Source Sans 3, IBM Plex Sans, Raleway; Talpas: Playfair
Display, Merriweather, Lora, PT Serif, Libre Baskerville, Source Serif 4,
Roboto Slab, IBM Plex Serif; Keskeny: Barlow Condensed, Roboto Condensed, IBM
Plex Sans Condensed; Lekerekített: Nunito, Nunito Sans, Quicksand, Varela
Round. Default pairing Montserrat / Open Sans. (Left out of this slice, see PLAN.md.)

## 5. Header (`.ph1`)

```css
.pp .ph1 { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.pp.logo-r .ph1 { flex-direction: row-reverse; }      /* Elhelyezés: Jobb */
.pp.logo-r .tt { text-align: left; }
.pp .co { display: flex; gap: 10px; align-items: center; min-width: 0; }   /* logo + issuer text */
.pp .co b { display: block; font-size: 12px; }                              /* issuer name, body 700 */
/* under the name: <small> "1114 Budapest, Bartók Béla út 21. 2/4. · Adószám: 66123456-1-33" (9.5px #666) */
.pp .tt { text-align: right; }
.pp .tt .tag { display: inline-block; background: #EEF0F4; color: #555; border-radius: 4px;
               font-size: 8px; font-weight: 700; padding: 1px 6px; margin-right: 6px;
               letter-spacing: .05em; vertical-align: middle; }              /* "KIÁLLÍTVA" */
.pp .tt .hd { font-size: 21px; color: var(--bd); letter-spacing: .01em; }   /* "SZÁMLA" */
/* under the title: <small> "Sorszám: INV-2026-00018" (9.5px #666) */
.pp .rule { height: 2px; background: var(--bd); }                           /* full content width */
```

With logo Jobb the logo stays to the left of the issuer text; only the two
header columns swap. The tag sits inline before the title when there is room,
otherwise it wraps above it (seen with the long Keretes sample).

### Logo

```
size  S = 22 px, M = 30 px (default), L = 42 px
Monogram: square sz x sz, radius 6 px, background --bd, white, 700,
          font-size round(sz * 0.42) (S 9, M 13, L 18), initials of the
          company name without "e.v./kft./zrt./bt.", first letters of the
          first two words, uppercase ("Kovács Anna e.v." -> "KA")
Saját logó: <img> height = sz px, max-width 120 px, object-fit contain
          (no file yet: dashed placeholder sz x sz, #E9EAEE bg, #999 text "logó",
           font-size round(sz * 0.3), 1px dashed #BBB, radius 6)
          upload accepts image/png and image/svg+xml
Nincs:    no logo; Méret and Elhelyezés controls are hidden
```

## 6. Meta strip (`.meta`)

```css
.pp .meta { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--tint); border-radius: 8px; }
.pp .meta > div { padding: 7px 9px; }
.pp .meta b { font-size: 10.5px; }                 /* value, body 700; caption above is i.hd */
```

| Layout | Override |
|---|---|
| Letisztult | no fill, radius 0, `border-bottom: 1px solid --line` |
| Sávos | tint fill, radius 0 (a full-width band) |
| Keretes | tint fill, radius 8, `border: 1px solid mix(--bd 35%, #fff)`, cell dividers `border-left: 1px solid --line` |

## 7. Parties (`.pty`)

```css
.pp .pty { display: grid; grid-template-columns: 1fr 1fr; }
.pp .pty > div { padding: 8px 10px; }
.pp .pty b { display: block; font-size: 10.5px; }      /* party name, body 700 */
/* caption i.hd KIBOCSÁTÓ / VEVŐ; lines in <small> 9.5px #666: address, Adószám, Bankszámla */
.pp .pty.one { grid-template-columns: 1fr; }            /* issuer box hidden */
```

| Layout | Override |
|---|---|
| Letisztult | `border-bottom: 1px solid --line`, cells `padding-left: 0` |
| Sávos | no background, cells `padding-left: 0` |
| Keretes | `border: 1px solid --line; border-radius: 8px`, divider `border-left: 1px solid --line` between the two cells |

## 8. Line items (`.pit`)

```css
.pp .pit { width: 100%; border-collapse: collapse; font-size: 10px; }
.pp .pit th { background: var(--bd); color: #fff; text-align: left; padding: 5px 7px;
              font-size: 8px; letter-spacing: .05em; font-weight: 500; }   /* heading font */
.pp .pit td { padding: 6px 7px; border-bottom: 1px solid #EEE; }           /* body font 10px */
/* description and gross are <b> (700); qty, unit price, VAT rate regular; numeric columns right-aligned */
```

Sávos and Keretes: filled header as above (computed th also carries a
`1px solid #E6E8EC` bottom border). Letisztult: `th { background: none; color: --bd;
border-bottom: 2px solid --bd; }`.

Column labels in the prototype: MEGNEVEZÉS, MENNY., EGYSÉGÁR, ÁFA, BRUTTÓ.

## 9. Totals (`.ptot`)

```css
.pp .ptot { align-self: flex-end; width: 55%; display: flex; flex-direction: column; gap: 3px; }   /* 271 px */
.pp .ptot > div { display: flex; justify-content: space-between; font-size: 10px; }
.pp .ptot small { font-size: 10px; color: #444; }                    /* "Nettó összesen", "ÁFA összesen" */
.pp .ptot .g { border-top: 2px solid var(--bd); padding-top: 6px; margin-top: 4px; align-items: baseline; }
/* .g: caption i.hd "FIZETENDŐ ÖSSZESEN" left, value right: */
.pp .ptot .g b { font-size: 15px; color: #111; }                     /* body 700 */
```

Identical in all three layouts (no dark band; the legacy renderer's navy
"amount due" band is gone).

## 10. Bank strip (`.pbank`)

```css
.pp .pbank { display: grid; grid-template-columns: 1.4fr 1fr; }
.pp .pbank > div { padding: 8px 10px; }
.pp .pbank b { font-size: 11px; letter-spacing: .02em; }    /* body 700 */
/* cells: BANKSZÁMLASZÁM | FIZETÉSI HATÁRIDŐ; with "Bankszámla adatok" off: one cell, FIZETÉSI HATÁRIDŐ only */
.pp .pbank.one { grid-template-columns: 1fr; }
```

| Layout | Override |
|---|---|
| Letisztult | `border-top: 1px solid --line`, cells `padding-left: 0` |
| Sávos | tint fill, radius 0 |
| Keretes | `border: 1px solid --line; border-radius: 8px`, divider between cells |

## 11. Note (`.pnote`)

```css
.pp .pnote { padding: 2px 2px 0; }
/* caption i.hd = noteLabel.toUpperCase() (default "MEGJEGYZÉS", max 40 chars) */
.pp .pnote span { display: block; font-size: 10px; color: #333; }
```

## 12. Footer (`.pfoot`)

```css
.pp .pfoot { margin-top: auto; display: flex; justify-content: space-between; gap: 10px;
             color: #555; font-size: 9.5px; border-top: 1px solid #E5E6EA; padding-top: 8px; }
.pp .pfoot em { font-style: normal; color: #888; }    /* "Készült az InvoHub-bal · invohub.hu" */
/* left: the user's "Lábléc szövege" (default "Köszönjük a bizalmát!") */
```

No brand mark in the footer (text only).

## 13. Draft watermark (from the Új számla paper)

```css
.paper .wm { position: absolute; left: 50%; top: 48%;
             transform: translate(-50%, -50%) rotate(-24deg);
             font: 700 90px var(--head);            /* on the 640 px composer paper = 78.75 px on the 560 px paper */
             color: rgba(63,107,196,.07); white-space: nowrap; pointer-events: none; }
```

Text: "Piszkozat". Only on unissued drafts.

## 14. Toggles ("Megjelenő adatok") as the prototype implements them

| Toggle | Prototype effect | Allowed in InvoHub? |
|---|---|---|
| Cégadatok blokk megjelenítése off | removes the issuer text from the header AND the KIBOCSÁTÓ box (`.pty.one`) | **No** for the header part: issuer name, address and tax number are mandatory (Áfa tv. 169. § c). See PLAN.md 6. |
| Bankszámla adatok megjelenítése off | removes "Bankszámla:" from the issuer box; bank strip shows only FIZETÉSI HATÁRIDŐ | yes (a bank account is not a 169. § element) |
| Ügyfél adószám megjelenítése off | removes the buyer's "Adószám:" line | only where it is not mandatory; see PLAN.md 6 |

Screenshots: `reference/settings-toggle-*.png`, `reference/settings-toggles-all-off.png`.

## 15. Form defaults ("Alapértelmezés visszaállítása")

```
logo: Monogram, logoSize: M, logoPos: Bal (left), color: #3F6BC4,
font: InvoHub, layout: Keretes (frame), showCompany/showBank/showTax: on,
noteLabel: "Megjegyzés", footer: "Köszönjük a bizalmát!"
(custom pairing defaults: Montserrat / Open Sans)
```
