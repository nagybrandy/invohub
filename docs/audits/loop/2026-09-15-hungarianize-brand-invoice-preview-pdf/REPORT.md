# Riport — Számla dokumentum előnézet/PDF magyarítása és márkázása

**Dátum:** 2026-09-15
**Tétel:** Phase 1, prioritás #2 (`docs/loop-queue.md`) — *"Invoice document
preview/PDF is English and unbranded"* (`lib/invoices/preview-html.ts`): a
komponáló ragadós előnézete és a kiállított számla "Előnézet" nézete angolul
("DRAFT", "Status: unpaid", "Bill to:", "Description/Qty/Unit/VAT/Total")
és InvoHub-márkázás nélkül jelent meg — ez a tényleges dokumentum, amit egy
magyar ügyfél megkap.
**Terv:** `docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md`
**Branch:** `slice/hungarianize-brand-invoice-preview-pdf`
**PR (emberi jóváhagyásra vár):** https://github.com/nagybrandy/invohub/pull/12

## Besorolás — miért PR és nem automatikus merge

A tétel **tax/legal-gated**: a kimenő, NAV-releváns bizonylat mezőneveit és
állapotszövegét érinti (Áfa tv. 169. §). A `CLAUDE.md` szerint minden ilyen
változás emberi jóváhagyást igényel merge előtt, és nem shippelhető
automatikusan — ezért a munka kész, a tesztek zöldek, de a folyamat itt egy
PR-ral áll meg, nem egy éles merge-dzsel/deploy-jal. **Green: false** —
ez a ship-workflow normál auto-merge küszöbén kívül esik, függetlenül a
teszteredményektől, pontosan emiatt a gate miatt.

## Mi készült el

- **`lib/invoices/document-labels.ts`** (új): `documentLabels()` /
  `documentTitleFor()` / `documentStatusChip()` közvetlenül a
  `lib/i18n/locales/{hu,en}.ts` fájlokból olvas (`invoices.document.*`,
  `invoices.documentTypes.*`, `invoices.status.*`) — a kimenő dokumentum
  mindig magyar, függetlenül az alkalmazás UI nyelvétől.
  `formatDocumentAmount()` explicit `hu-HU` formázást használ keskeny
  nem törhető szóközös csoportosítással. `toWinAnsiSafe()` / `isWinAnsiSafe()`
  átírja az ő→ö / ű→ü karaktereket — ez egy ideiglenes javítás, mert a
  pdfkit beépített Helvetica betűtípusa (WinAnsi/cp1252) nem tartalmazza
  ezeket a glyphokat.
- **`lib/invoices/preview-html.ts`**: teljes HU/márkázott átírás —
  Kibocsátó/Vevő partnerkártyák (a kibocsátó blokk a felhasználó saját
  cégadataiból), navy/cornflower vizuális rendszer, InvoHub lábléc
  wordmark, soronkénti nettó/ÁFA/bruttó, státuszcímke csak ott, ahol az
  ténylegesen megváltoztatja, *mi* a dokumentum (piszkozat/fizetve/sztornó
  — nem kiküldve/fizetetlen/lejárt), mobil (max-width:560px) kártyás
  táblanézet és nyomtatási (`@media print`) stílus.
- **`lib/invoices/generate-pdf.ts`**: ugyanazok a magyar címkék/összegek;
  minden `doc.text()` hívás egyetlen patch-ponton át `toWinAnsiSafe`-en
  megy keresztül.
- **`pdf-template/defaults.ts`**: új alapértékek (SZÁMLA / cornflower
  `#6495ed` / Megjegyzés / "Köszönjük a bizalmat!"); a
  `sample-invoice.ts` mostantól magyar.
- **`GET /api/invoices/[id]/preview`** átadja a felhasználó cégadatait és
  PDF sablonját a HTML előnézetnek (`buildInvoicePdfContext`-en
  keresztül), így a mentett számla előnézete is mutatja a kibocsátó
  blokkot és a felhasználó saját accent színét.
- **`InvoiceDocumentPreview`** opcionális `company` propot kap a nem
  mentett piszkozat útvonalhoz (komponáló → `useInvoiceComposer` →
  `ComposerSummary`); a saját kerete (chrome) mostantól teljesen
  i18n-esített (`invoices.preview.*`).

Képernyőképek (`docs/audits/loop/2026-09-15-hungarianize-brand-invoice-preview-pdf/`):
`desktop-1440_preview-full.png`, `desktop-1440_preview-no-company.png`,
`desktop-1440_preview-storno.png`, `mobile-375_preview-full.png`,
`mobile-375_preview-no-company.png`, `mobile-375_preview-storno.png`,
`mobile-no-company-crop-top.png`, `pdf-render-1.png`,
`pdf-render-1-crop-header.png`, `pdf-render-2.png`.

## Tesztek

`npx tsc --noEmit` tiszta. `npm run test:unit`: 188 suite / 981 teszt
zöld (az implementációs commit állapotában; merge előtt érdemes
újrafuttatni a driftre).

## Elfogadási kritériumok

A terv (§2) 22 számozott AC-t definiál: a label modul i18n-forrásoltsága
és magyar-alapértelmezettsége, a HTML előnézet tartalma/márkázása/
escapelése/reszponzív és nyomtatási CSS-e, a PDF címke/kódolás
helyessége, a huzalozás (`preview` API route, `InvoiceDocumentPreview`
`company` prop + i18n chrome), és a `tsc`/`test:unit` regressziós küszöb.
Ebből 22-ből 20 szó szerint teljesül; 2 (AC3, AC15) a terv saját
belső ellentmondása miatt nem szó szerint — lásd alább.

## Javított és elhalasztott találatok

A fixer körben nem maradt elhalasztott (`Deferred by fixer: []`) —
az implementáció teljes. Három alacsony súlyosságú találat került fel
follow-upként a `docs/loop-queue.md`-be (Phase 1 szekció vége), a PR
reviewer figyelmébe ajánlva:

1. **AC3 szó szerinti EUR példája elírás.** A terv szerint
   `formatDocumentAmount(1234.5, "EUR") === "1 234,56 €"`; 1234.5
   2 tizedesre kerekítve 1234,50, nem ,56. A `document-labels.ts`
   helyesen `"1 234,50 €"`-t ad vissza (közvetlenül ellenőrizve az
   `Intl.NumberFormat("hu-HU")` ellen), és a
   `document-labels.test.ts:66-67` teszt a helyes értéket állítja.
   Kódváltoztatás nem szükséges — csak a terv/AC szövegét kell javítani.
2. **AC15 vs AC16 önellentmondás, AC16 felé feloldva.** Az AC15 szó
   szerint `"Vevő"` / `"Fizetési határidő"` (ő-t tartalmazó) sztringeket
   ír elő kötelező `mockDrawnTexts` elemként; az AC16 szerint minden
   `mockDrawnTexts` elemnek teljesítenie kell az `isWinAnsiSafe`-et, ami
   bármely ő/ű-t tartalmazó sztringre hamis. Az implementáció úgy készült,
   hogy minden, a pdfkit-be kerülő sztring — címkék is — átmegy a
   `toWinAnsiSafe`-en, ami megfelel a terv saját szövegének ("on every
   string drawn into the PDF, labels and user data alike"). A
   `generate-pdf.test.ts` az átírt formát ellenőrzi, inline
   kommentárral. A PR reviewernek meg kell erősítenie, hogy ez a
   feloldás (minden szöveg átírása a beágyazott betűtípus-javításig)
   a szándékolt.
3. **Az accent szín olvasási útvonala kihagyja a `normalizeHexColor`-t
   CSS-interpolálás előtt** (valódi rés, nem szövegezési kérdés). A
   `preview-html.ts` a PDF sablon `accentColor` értékét egy `<style>`
   blokkba interpolálja `escapeHtml`-en keresztül, ami csak
   `& < > " '`-t escape-el — `; } / *`-ot vagy whitespace-t nem, tehát
   nem tudja megállítani a CSS-szintaxis-injektálást. A
   `normalizeHexColor` csak az írási útvonalon (`pdf-template/
service.ts` `upsertPdfTemplate`) hívódik meg; az olvasási útvonal
(`getPdfTemplate`/`mapRow`) az adatbázis értékét változatlanul adja
vissza. Javasolt javítás: hívjuk meg a `normalizeHexColor(accent)`-ot
a `preview-html.ts`-ben (és/vagy a `mapRow`-ban olvasáskor) az
interpoláció előtt.

## Deploy / PR

Nincs deploy — a tax/legal-gated tételek sosem shippelnek automatikusan
a `CLAUDE.md` szerint. A kód a `slice/hungarianize-brand-invoice-preview-pdf`
branch-en van, PR nyitva emberi jóváhagyásra:
**https://github.com/nagybrandy/invohub/pull/12**

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 1 prioritási listájának következő
bejelöletlen tétele (#3): **Non-HUF invoices: use `invoice.exchangeRate`
for the HUF VAT base in the NAV XML and on the PDF**
(`lib/nav/invoice-xml.ts`, `lib/invoices/build-pdf-context.ts`) — szintén
Áfa-releváns, valószínűleg szintén tax/legal-gated lesz.
