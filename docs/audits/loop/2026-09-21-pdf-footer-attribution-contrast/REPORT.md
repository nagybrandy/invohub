# Ship report — pdf-footer-attribution-contrast

**Datum:** 2026-09-21
**Fazis:** 1 — Core invoicing (NAV-compliant)
**Backlog tetel:** `docs/loop-queue.md` — "Footer attribution text stays at
pre-existing low contrast (~3.17:1) after gaining the mark" (2026-09-16-i
ship review, `slice/pdf-invohub-brand-mark`, ux finding)
**Branch:** `slice/pdf-footer-attribution-contrast` -> mergelve a `main`-be
(`213d555`)

## A problema

A szamla-elonezet HTML `.footer` szabalya (`lib/invoices/preview-html.ts`)
es a pdfkit-alapu PDF lablec a `#8a90a6` szint hasznalta lablec-szovegre
(`font-size: 0.78rem`). Feher hatteren ennek a kontrasztaranya kb. 3.17:1,
ami a WCAG AA normal szovegre vonatkozo 4.5:1-es kuszobe alatt van.

## Mi keszult el

- Uj `lib/theme/contrast.ts` modul: WCAG 2.x `relativeLuminance` es
  `contrastRatio` segedfuggvenyek, unit teszttel (`lib/theme/contrast.test.ts`).
- Uj `lib/invoices/document-ink.ts` megosztott token-modul
  (`documentInk` / `documentSurfaces`), amelyet mind a HTML-elonezet, mind
  a pdfkit PDF-renderer importal, hogy a ket renderelesi ut szinben ne
  tudjon szetcsuszni. A `documentInk.muted` erteke `#5b6178`
  (6.13:1 kontraszt feher papiron) — ez valtja a regi `#8a90a6` (3.17:1)
  es `#666666` szineket.
- Erintett fajlok: `lib/invoices/preview-html.ts` (`.footer` es a mobil
  stacked-table `td::before` cimkek), `lib/invoices/generate-pdf.ts`
  (`footerText` / `pageIndicatorText`), `lib/invoices/pdf-brand-mark.ts`
  (`drawBrandLockup`).
- Tisztan szin-modositas: nincs i18n kulcs-valtozas, nincs
  `db/schema.ts` modositas, nincs renderelt szoveg-valtozas.

## Tesztek

- Uj unit tesztek: `lib/theme/contrast.test.ts`,
  `lib/invoices/document-ink.test.ts`, kiegeszitve
  `lib/invoices/preview-html.test.ts`, `lib/invoices/generate-pdf.test.ts`,
  `lib/invoices/pdf-brand-mark.test.ts` teszteket a friss token hasznalatara.
- Ship elott a `main`-en lefuttatva: `npm run typecheck` — zold.
  `npm run test:unit` — 221/221 suite, 1458/1458 teszt zold.
- `db/schema.ts` nem valtozott, `db:push` nem volt szukseges.

## Talalt, de nem blokkolo hianyossagok

Ebben a menetben nem erkezett uj alacsony sulyossagu (`low`) megallapitas
a fixer/reviewer kortol, igy a `docs/loop-queue.md` nem kapott uj
"follow-up" bejegyzest ebbol a ship menetbol. Az eredeti backlog tetel
`[x]`-re lett pipalva, es a hozza tartozo javitas leirasa bekerult a
tetel ala (lasd a `slice/pdf-footer-attribution-contrast` branch
`b2e72f9` commitjat es a mergelt `docs/loop-queue.md`-t).

## Deploy

- `git push origin main`: `4a50c9e..213d555`
- `vercel --prod --yes`: production deployment
  `https://invohub-dpecmvvad-codences-projects.vercel.app`, aliasolva
  `https://www.invohub.hu`-ra.
- Smoke teszt: `curl https://invohub.vercel.app/` -> 200,
  `curl https://invohub.vercel.app/login` -> 200.
  `PRODUCTION_BASE_URL=https://invohub.vercel.app npm run test:smoke:production`
  -> 12/12 Playwright smoke teszt zold (desktop + mobile).

## Kovetkezo javasolt tetel

A `docs/loop-queue.md`-ben a Fazis 1 alatt a legfelso meg kipipalatlan
tetel a soron kovetkezo ship-cel — jelenleg az
`exchange-rate-input-tap-target-mobile` es a
`notification-backfill-i18n-legacy-rows` tetelek vannak terv alatt
(lasd a `docs/plans/` alatti friss terv-fajlokat es a nyitott
`slice/*` branch-eket ugyanezen backlog tetelekhez).
