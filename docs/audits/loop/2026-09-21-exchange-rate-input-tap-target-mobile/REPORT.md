# Ship riport — exchange-rate-input-tap-target-mobile

**Dátum:** 2026-09-21
**Fázis:** 1 — Core invoicing (NAV-compliant), UX-javítás, nem tax/legal/NAV-gated
**Branch:** `slice/exchange-rate-input-tap-target-mobile`
**Terv:** `docs/plans/2026-09-21-exchange-rate-input-tap-target-mobile.md`
(a tervező-commit: `6d4d8bc Plan: exchange-rate-input-tap-target-mobile`)

## A tétel

`docs/loop-queue.md` (Phase 1) tétele:

> A `StepPartner.tsx`-ben lévő új exchange-rate `Input` és a currency pillek
> mobilon ~34px magasak, a 44px tap-target irányelv alatt — ugyanaz a
> méretezés, mint amit minden más composer `Input` már használ, és a
> currency-selector tap-target munka már külön fel van véve (ld. a fenti 8.
> tételt); csak azért szerepel itt, hogy az exchange-rate mező ne maradjon ki,
> amikor azt a tételt felveszik. (2026-09-15 ship review a
> `slice/non-huf-invoice-exchange-rate-nav-xml`-ből, ux)

## Mi derült ki és mi készült el

A currency pillek már 44px-en voltak (a `slice/invoice-flow-tap-targets-44px`
óta, `ChoicePill`/`ChoicePillGroup` `min-h-11`-je) — erre csak regressziós
védelem került (a meglévő `StepPartner.test.tsx` lefedettség újra zöldre
ellenőrizve).

A valódi hiba: a `components/ui/input/index.tsx` `inputStyle` alapja `h-9`
(fix 36px) volt, nem hívási helyenkénti osztály — ez az app **156**
`<Input` hívási helyét érintette, köztük az exchange-rate mezőt is. Megoldás:

- `TAP_TARGET_H` ("h-11") hozzáadva a `lib/ui/tap-target.ts`-hez, ebből
  származtatva a `TAP_TARGET_ICON_BOX`.
- `components/ui/input/index.tsx` `inputStyle` alapja mostantól ezt
  használja, exportálva (egy `tva()`-nullargumentumos wrapperrel, ahogy a
  `buttonStyle`-nál). Minden `Input` az appban (composer mezők, settings
  űrlapok, keresőmezők) mostantól konstrukció szerint ≥44px.
- Két másik, ugyanabban a szekcióban lévő 36px-es dátumvezérlő is javítva:
  `DateInput.tsx` web ága és `date-field/index.web.tsx`.
- `LineItemRow.tsx` mértékegység-pill (unit pill) is 44px-re emelve, hogy
  illeszkedjen a mellette lévő mennyiség mezőhöz.
- A törlés gomb (`h-9 w-9` + `hitSlop={8}`) szándékosan változatlan maradt.

Nincs `lib/tax/`, `lib/nav/`, `lib/m2m/` vagy marketing módosítás, nincs új
i18n kulcs, nincs séma-változás.

## Tesztek

Új/bővített tesztek a branch-en:

- `lib/ui/tap-target.test.ts`
- `components/ui/input/tap-target.test.ts` (új)
- `components/invoices/composer/DateInput.test.tsx` (új — korábban nem volt
  teszt ehhez a fájlhoz)
- `components/ui/date-field/DateField.test.tsx`
- `components/invoices/composer/LineItemRow.test.tsx`

Ship-időben, a `main`-be mergelve:

- `npm run typecheck` — zöld
- `npm run test:unit` — **219 suite / 1434 teszt, mind zöld**

## Talált és elhalasztott findingok

Ehhez a ship körhöz nem tartozott új low-severity finding a fix-agenttől
(üres lista), és a fixer sem halasztott el semmit — nincs mit hozzáfűzni a
`docs/loop-queue.md`-hez ezen felül. Az érintett queue-tétel a branch részeként
már `[x]`-re lett állítva, a "**Shipped**" jegyzettel kiegészítve.

## Deploy

- Merge: `slice/exchange-rate-input-tap-target-mobile` → `main` (no-ff merge),
  push: `origin/main` `8ed5712..f87e50c`
- `vercel --prod`: **https://invohub-kdpd3wfha-codences-projects.vercel.app**
  (production alias: **https://www.invohub.hu**)
- Smoke teszt:
  - `curl https://invohub.vercel.app/` → `200`
  - `curl https://invohub.vercel.app/login` → `200`
  - `npm run test:smoke:production` (`PRODUCTION_BASE_URL=https://invohub.vercel.app`)
    — **12/12 teszt zöld** (health endpoint, JS bundle, marketing assets,
    home page, login page, elsődleges CTA → login navigáció; desktop +
    mobile viewport)

## Következő javasolt tétel

A backlog top nem-elkezdett tétele (`docs/loop-queue.md`, Phase 0 —
Stabilization, mert az a Phase 1 mellett/előtt futtatandó cross-cutting
hardening): **"Reminders cron reliability"** — ellenőrizni, hogy
`app/api/cron` / `app/api/reminders` + `lib/reminders/process.ts` kezeli-e az
újrapróbálkozást és a részleges hibákat, nem csak a happy path-et.
