# Ship report — pdf-broken-pagination-blank-page

**Dátum:** 2026-09-16
**Tétel:** "Broken pagination wastes an entire page" — az alapértelmezett
sablonnal (rövid lábléc-szöveg, két tétel, rövid megjegyzés) a PDF egy
majdnem üres második oldalra csordult át csak azért, hogy egyetlen
lábléc-sort mutasson. A gyanú a `contentBottom`/`ensureSpace`
(`lib/invoices/pdf-layout.ts`) vagy a lábléc-elhelyezési logika
(`generate-pdf.ts`, ~336. sor) hibás helyfoglalására esett.
**Terv:** `docs/plans/2026-09-16-pdf-broken-pagination-blank-page.md`
**Branch:** `slice/pdf-broken-pagination-blank-page` (mergelve `main`-be:
`5ee1df5`, implementáció HEAD-je: `da5074e`)

## Eredmény: sikeresen shippelve, production deployolva

A tervezési fázis (2026-09-16, Opus) a felszíni tünet mögött három valódi
hibát azonosított és reprodukált `ac736d6` ellen, `pdftoppm`-mel PNG-re
renderelve:

1. **Tartalom fut át a lábléc-sávon** — a dokumentum `margin: 48`-cal
   készült, így pdfkit saját `doc.text()` auto-lapozása 36pt-tal a lábléc
   számára fenntartott sáv *alatt* tört (16 tételes számla + hosszú
   `notes` esetén volt látható).
2. **`drawTotalLine` fix magasságot adott vissza** (`y + fontSize + 6`) a
   "Fizetendő összesen:" 80pt-es oszlopba rajzolásakor, így a tördelt
   második sor átfedte a következő blokkot (ÁFA-mentes számlán, az
   "Alanyi adómentes …" szöveggel ütközve).
3. **A helyfoglalások "mágikus számok" voltak** (`90` a totals blokkra kb.
   68pt mért érték helyett; `20 + reasons*14` tördelés figyelembevétele
   nélkül; `48` egy tetszőleges magasságú notes blokkra), és az
   `ensureSpace`-nek nem volt "már az oldal tetején állok" védelme — egy
   24 tételes számla a totals+notes blokkot a 2. oldalra tolta ~77pt
   szabad hellyel az 1. oldalon.

## Mi történt (implementáció, `da5074e`)

- A lábléc számára fenntartott sávot beépítettük a dokumentum saját alsó
  margójába (`CONTENT_MARGIN_BOTTOM = PAGE_MARGIN + FOOTER_BAND_HEIGHT =
  84`), így pdfkit saját auto-lapozása és az `ensureSpace()`/
  `contentBottom()` ugyanott tör meg — konstrukció szerint, nem esetlegesen.
- `ensureSpace()` védelmet kapott: nem nyit új oldalt, ha már az oldal
  tetején állunk.
- A fix 90pt-es totals-tartalék és a fix lépésközű `drawTotalLine()`
  helyett mért geometria (`totalsColumns()`) — a "Fizetendő összesen:" sor
  nem tördelődik és nem fedi át a következő blokkot.
- Mért (nem fix) tartalék az adómentességi indoklás és a notes blokk
  számára.
- Ismételt táblázatfejléc + "`<számlaszám>` · folytatás" felirat a
  folytatólagos oldalakon, valamint "{{oldal}}/{{összes}}. oldal"
  lábléc-jelző többoldalas dokumentumokon.

**Mért oldalszámok:** `buildSamplePreviewInvoice()` — a slice előtt 2/2
(céggel/cég nélkül), a slice után **1/1**, most már egy valódi pdfkit
regressziós teszttel lezárva (`BASELINE_PAGE_COUNT` `<= 2`-ről `=== 1`-re
szigorítva). Egy 16 tételes, ~2000 karakteres `notes`-szal rendelkező
számla és egy 40 tételes számla is ellenőrizve (`pdftoppm` PNG-render),
hogy sehol nem fut tartalom a lábléc-sávon, és a 40 tételes számla
helyesen ismétli az oszlopfejlécet és rajzolja ki a folytatás-feliratot a
folytatólagos oldalon.

## Tesztek

- `npx tsc --noEmit` — zöld a merge-elt `main`-en.
- `npm run test:unit` — **202 suite / 1179 teszt, mind zöld** (a merge-elt
  `main`-en, a `docs/loop-queue.md` follow-up commit után).
- Módosított/bővített tesztfájlok: `lib/invoices/generate-pdf.test.ts`,
  `lib/invoices/generate-pdf.integration.test.ts`,
  `lib/invoices/pdf-layout.test.ts`, `lib/i18n/locales/en.test.ts`.

## Findingok — javítva ebben a körben

A tétel maga (a "broken pagination" hiba) javítva; nincs
tax/legal/NAV-production érintettség (kizárólag dokumentum-renderelés/
tipográfia — nem nyúlt `lib/tax/`-hoz, `lib/nav/` production
viselkedéshez, `lib/m2m/`-hez, séma- vagy megfelelőségi szöveghez), ezért a
normál Ship-fázis auto-merge alkalmazható volt.

## Findingok — elhalasztva (alacsony súlyosságú, nem blokkoló)

Mindhárom felkerült a `docs/loop-queue.md`-be `- [ ]` tételként, a Phase 1
szekcióban, közvetlenül e tétel bejegyzése után:

1. **Elavult teszt-lefedettségi állítás** (`acceptance`) —
   `lib/invoices/generate-pdf.test.ts` 489. sora azt állítja, hogy az üres
   `footerText` középre igazított brand-lockup ága "máshol le van fedve",
   de ilyen teszt sehol nincs a repóban. Az ág maga változatlan a
   `main`-hez képest (diff-fel megerősítve), tehát ez dokumentációs/
   teszt-állítási pontatlanság, nem funkcionális regresszió.
2. **Notes-only folytatólagos oldalnak nincs számlaszám/kontextus fejléce**
   (`ux`) — a `drawContinuationCaption` csak a tételsor-ciklusba van
   bekötve, a notes blokkba nem. AC11-nek megfelel (ahogy írva van, a
   feliratot a tételsoros oldalakra szűkíti), így nem AC-sértés, csak egy
   opcionális, nem kötelező csiszolási lehetőség.
3. **Nincs Playwright viewport-audit-relevancia** (`ux`) — ez a slice
   kizárólag `lib/invoices/` és `lib/i18n/locales/` fájlokat érintett, nincs
   megváltozott `app/`/`components/` képernyő, így a standard
   képernyő-viewport audit nem alkalmazható erre a körre.

## Deploy

- `git push origin main` — `ac736d6..5ee1df5`
- `vercel --prod --yes` — **sikeres**
  - Production URL: `https://invohub-4ykf38aah-codences-projects.vercel.app`
  - Alias: `https://www.invohub.hu`
  - Deployment ID: `dpl_F69ZTRABMJRsK49naCdtGniPmkfk`, `readyState: READY`

## Smoke teszt

- `curl https://invohub.vercel.app/` → **200**
- `curl https://invohub.vercel.app/login` → **200**
- `PRODUCTION_BASE_URL=https://invohub.vercel.app npm run test:smoke:production`
  → **12/12 teszt zöld** (health endpoint, statikus marketing eszközök,
  belépési JS bundle, elsődleges CTA → login, marketing kezdőlap, login
  oldal — desktop és mobile projekten is)

**`smokeOk: true`**

## Javasolt következő tétel

A Phase 1 szekcióban a legközelebbi nyitott tétel: **"General layout gap
vs. the HTML preview"** — a PDF tartalmi területe ritkás (sok üres
függőleges hely, vékony egyoszlopos tételtáblázat, nincs kártya/szekció
keretezés) a HTML előnézet sűrűbb, kártya-alapú, vizuálisan kész
elrendezéséhez képest. Nem kell pixel-pontosan egyeznie (a pdfkit nem
CSS), de ugyanannak a terméknek/márkának kell hatnia — a
`preview-html.ts` szekció-struktúrája (VEVŐ kártya, tételsor-táblázat
stílus, totals blokk) a referencia arra, hogy milyen a "kész" itt.
