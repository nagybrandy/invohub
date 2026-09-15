# Riport — Nem HUF számlák valódi árfolyama a NAV XML-ben és a dokumentumon

**Dátum:** 2026-09-15
**Tétel:** Phase 1, prioritás #3 (`docs/loop-queue.md`) — *"Non-HUF invoices
report a false HUF VAT base to NAV"*: a `lib/nav/invoice-xml.ts` hardkódolt
`<exchangeRate>1</exchangeRate>`-et küldött NAV-nak minden nem HUF számlánál,
holott `invoice.exchangeRate` már létezik és a komponáló be is gyűjti. Egy
1000 EUR-s számla így hamisan 1000 Ft nettó / 270 Ft ÁFA alapként került
jelentésre a kötelező adatszolgáltatásban.
**Terv:** `docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md`
**Branch:** `slice/non-huf-invoice-exchange-rate-nav-xml`
**PR (emberi jóváhagyásra vár):** https://github.com/nagybrandy/invohub/pull/13

## Besorolás — miért PR és nem automatikus merge

A tétel **tax/legal-gated**: a `lib/nav` XML-generálást és a kimenő,
ügyfélnek küldött dokumentum ÁFA-forint összegét érinti — valódi Áfa tv.
kérdés, nem kódolási döntés (lásd a terv OQ-1/OQ-2/OQ-3 nyitott kérdéseit
lent). A `CLAUDE.md` szerint minden ilyen változás emberi jóváhagyást
igényel merge előtt, ezért a munka kész és a tesztek zöldek, de a folyamat
itt egy PR-ral áll meg — nincs automatikus merge, nincs deploy.

## Mi készült el

- **`lib/invoices/exchange-rate.ts`** (új, tiszta modul, nincs I/O, nincs
  i18next-import): `requiresExchangeRate`, `parseExchangeRateInput`
  (`"390,5"` és `"390.5"` is elfogadott, `<= 0`/NaN → `null`),
  `resolveExchangeRate` (`{ok:true, rate}` vagy `{ok:false, reason:
  "missing"|"invalid"}`), `toHufAmount` (2 tizedesre kerekít),
  `formatExchangeRate` (max. 6 tizedes, levágott nullák, `.` szeparátor
  az XML-hez).
- **`lib/nav/invoice-xml.ts`**: `buildNavInvoiceXml` a legelején egyszer
  feloldja az árfolyamot és **dob**, ha nincs használható érték — ekkor
  **nem** íródik `navSubmission` sor és a `client.manageInvoice` sosem
  hívódik meg, tehát a rendszer inkább visszautasítja a beküldést, mint
  hogy hamis HUF alapot jelentsen. A valódi `<exchangeRate>` és minden
  `…HUF` elem (`lineNetAmountHUF`, `lineVatAmountHUF`,
  `lineGrossAmountNormalHUF`, `vatRateNetAmountHUF`, `vatRateVatAmountHUF`,
  `vatRateGrossAmountHUF`, `invoiceNetAmountHUF`, `invoiceVatAmountHUF`,
  `invoiceGrossAmountHUF`) most a valódi árfolyamból számított értéket
  kapja — soronként konvertálva, majd összegezve (sosem egy már összegzett
  totált konvertál), hogy a NAV kereszt-összeg ellenőrzése stimmeljen.
- **`app/api/invoices+api.ts`** (`POST`): eddig csendben eldobta
  `body.exchangeRate`-et (csak a `PATCH` őrizte meg) — ez volt az
  aszimmetria oka, hogy szerkesztésnél "működni látszott" az árfolyam,
  létrehozásnál nem. Mostantól a create útvonal is elmenti.
- **`lib/invoices/create-from-payload.ts`** (a publikus `POST
  /api/v1/invoices`): `ExternalInvoiceInput` mostantól tartalmazza az
  `exchangeRate` mezőt.
- **Komponáló** (`components/invoices/composer/`): a mentés blokkolva van
  hiányzó/érvénytelen árfolyamnál, mielőtt az API-hoz egyáltalán eljutna
  — beleértve a vesszős tizedes bevitelt (`"390,5"`) is (round 2 javítás:
  `a3e2191`, ami a `Number("390,5")` → `NaN` → csendben `null`-lá váló
  JSON-hibát javította).
- **`lib/invoices/preview-html.ts` / `generate-pdf.ts`**: az EUR/nem HUF
  dokumentum most megmutatja a használt árfolyamot és az ÁFA forint
  összegét az EUR ÁFA összeg mellett.
- **i18n**: új `invoices.document.exchangeRate` / `exchangeRateValue` /
  `vatInHuf` kulcsok (`lib/i18n/locales/{hu,en}.ts`) — a terv §6 szerint
  előre felvéve a folyamatban lévő márkázási branch-hez (lásd alább az
  1. találatot), a jelen branch-en még nem kerülnek felhasználásra, mert
  a `preview-html.ts`/`generate-pdf.ts` még a márkázás előtti,
  angol-nyelvű változat.

## Tesztek

A terv (§3) 16 számozott elfogadási kritériumot definiál — mind a 16
teljesül. `npx tsc --noEmit` tiszta, `npm run test:unit`: 992 teszt zöld
(a shippelt commit állapotában). Új/frissített tesztfájlok:
`lib/invoices/exchange-rate.test.ts`, `lib/nav/invoice-xml.test.ts`,
`lib/invoices/create-from-payload.test.ts`,
`lib/invoices/generate-pdf.test.ts`, `lib/invoices/preview-html.test.ts`,
`lib/nav/submit-outgoing.test.ts`,
`components/invoices/composer/composer-logic.test.ts`,
`components/invoices/composer/useInvoiceComposer.test.tsx`,
`__tests__/api/invoices/invoices-api.test.ts`.

## Javított és elhalasztott találatok

A fixer körben nem maradt elhalasztott (`Deferred by fixer: []`). A ship
review során három alacsony súlyosságú találatot vizsgáltunk meg;
mindegyik follow-upként felkerült a `docs/loop-queue.md` Phase 1
szekciójába, a PR reviewer figyelmébe ajánlva. Kódváltoztatás egyikhez
sem szükséges ebben a diffben:

1. **Az új `invoices.document.*` i18n kulcsok szándékosan
   felhasználatlanok ebben a szeletben — nem hiba.** Az eredeti találat
   inkonzisztenciának minősítette ezt, de ez tévedés: a terv saját
   "Rebase note — overlap with the in-flight branding slice" szakasza
   (sor 246–259) kifejezetten ezt írja elő, amíg a
   `slice/hungarianize-brand-invoice-preview-pdf` branch (PR #12, még
   nyitva, nincs commitja a `preview-html.ts`/`generate-pdf.ts` fájlokon)
   nincs merge-elve a `main`-be: a jelenlegi (angol, márkázatlan)
   rendererekhez illő `formatCurrency` + hardkódolt angol szöveg
   használandó, nem az új namespace. A kulcsok előre fel lettek véve a
   terv §6 szerint, a későbbi rebase-hez.
2. **`focusField: "exchangeRate"` sikertelen mentés után nem kerül
   felhasználásra vagy törlésre.** A `composer-logic.ts`
   `validateExchangeRateInput`-ja beállítja, a `useInvoiceComposer.ts`
   alkalmazza sikertelen mentésnél, de a `StepPartner.tsx` csak a
   `clientName` fókuszmezőt kezeli — az árfolyam inputnak nincs is
   ref-je. Javaslat: ref hozzáadása és a fókusz-effektus kiterjesztése
   `focusField === "exchangeRate"`-re, ugyanúgy hívva a
   `clearFocusField()`-ot, mint a clientName ágon.
3. **Az új árfolyam-input és a pénznem-választó gombok ~34px magasak
   mobilon** (44px tap-target irányelv alatt) — megegyezik a komponáló
   többi input mezőjének méretezésével, és a terv (sor 348) kifejezetten
   külön, hatókörön kívüli tételként jelöli a pénznem-választó
   tap-target munkáját.

## Deploy / PR

Nincs deploy — a tax/legal-gated tételek sosem shippelnek automatikusan
a `CLAUDE.md` szerint. A kód a `slice/non-huf-invoice-exchange-rate-nav-xml`
branch-en van, PR nyitva emberi jóváhagyásra:
**https://github.com/nagybrandy/invohub/pull/13**

A `docs/loop-queue.md`-ben a tétel állapota `[~] needs sign-off (PR)`-re
frissült.

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 1 prioritási listájának következő
bejelöletlen tétele (#4): **Payment method + payment date into the NAV
XML** (`paymentMethod`, `paidAt` bekerülése a `lib/nav/invoice-xml.ts`-be)
— a loop-queue meglévő jegyzete szerint is tax/legal-gated lesz, és a
publikált `invoiceData.xsd` alapján kell ellenőrizni a mezőelhelyezést,
nem találgatva.
