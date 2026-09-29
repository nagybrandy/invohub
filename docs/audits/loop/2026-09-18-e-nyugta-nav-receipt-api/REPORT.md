# Ship report — e-nyugta-nav-receipt-api (slice 1/3)

**Dátum:** 2026-09-18
**Tétel:** "e-nyugta: real NAV eRECEIPT API (nav-gov-hu/eRECEIPT spec v1.3 /
XSD 1.1.1, test base https://bv-receipt-if.enyugta.nav.gov.hu/v1) behind
demo/test modes — slice 1 of 3: auth token + /receipt/create + XSD-shaped
payload rebuild." `docs/loop-queue.md`, Phase 1 — "Remaining for the launch
gate", és a rövid prioritás-lista 7. pontja.
**Terv:** `docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md` (felváltja a
`docs/plans/2026-09-16-e-nyugta-nav-receipt-api.md` tervet, amit soha nem
építettek meg).
**PR:** https://github.com/nagybrandy/invohub/pull/17 (nincs mergelve —
tax/legal aláírásra vár)
**Branch:** `slice/e-nyugta-nav-receipt-api` (HEAD: `9484ab9`; implementáció:
`7b995f2`, javító kör: `484cc85`, ez a ship-kör: `9484ab9`)

## Eredmény: PR nyitva, tax/legal aláírásra vár — nincs merge, nincs deploy

A bemenő állapot `Green: false`, `Gated: true` volt. A Ship-fázis a saját
worktree-jében (`.claude/worktrees/wf_0d3387d5-523-3`) futtatta a
típusellenőrzést és a teszteket a legfrissebb kóddal (ld. lent a branch
rekonciliációt) — ezek ténylegesen **zöldek**, de a tétel `CLAUDE.md`
szerint tax/legal kapuzott (a mandatory nyugta-adatszolgáltatás tartalmát
dönti el — melyik ÁFA-kategóriába kerül minden forint, hogyan aggregálódnak
a napi bruttó összegek, melyik nap kerül egyáltalán jelentésre), ezért a
Ship-fázis **nem mergelt és nem deployolt**, függetlenül a zöld
buildtől — a kapu emberi jóváhagyás, nem a build státusza.

## Branch-rekonciliáció

A megadott `slice/e-nyugta-nav-receipt-api` branch a saját worktree-jében
(`wf_0d3387d5-523-3`) még a build-kör commit-jánál állt (`7b995f2`), és nem
tartalmazta a review után lefutott javító kört. Két külön névvel futó
javító-branch is létezett, azonos commit-tal:
`fixround1-e-nyugta-nav-receipt-api` és `fixround2-e-nyugta-nav-receipt-api`
(mindkettő `484cc85` — "fix(nav-receipt): stop mixing up currency-group NAV
rows on receipt detail"). A Ship-fázis ellenőrizte, hogy a `slice/…` branch
őse a javító commit-nak (`git merge-base --is-ancestor` — igen), majd a
`slice/e-nyugta-nav-receipt-api` branch-et a saját worktree-jében
**fast-forward**-olta `484cc85`-re (`git merge --ff-only
fixround2-e-nyugta-nav-receipt-api` — tiszta fast-forward, semmi nem
veszett el). Nem volt szükség másik worktree törlésére vagy egyéb
destruktív műveletre.

## Mi shippelt (`7b995f2` + `484cc85`, ship-kör: `9484ab9`)

Újraépítve a `lib/nav-receipt/` a ténylegesen publikált NAV-interfész
(`receipt-if-schema-v1.1.1.xsd`) ellenében — a régi kliens egy kitalált
`/authenticate` végpontra JSON-t küldött, kitalált névtérrel és mezőkkel
(`netAmount`/`vatAmount`/`grossAmount`/`vatRateCode`/`startReceiptNumber`/
`endReceiptNumber`/`cancelledCount`), amelyek nem léteznek a sémában — minden
"NAV teszt" nyugta-beküldés hálózati hibával vagy elutasítással végződött.

- Új `AuthTokenRequest` / `CreateReceiptRequest` XML az
  `http://schemas.nav.gov.hu/NTCA/1.0/receipt` névtérben, valódi SHA3-512
  kérés-aláírás (a már ellenőrzött `lib/nav/crypto.ts`-re delegál), két
  külön `requestId` forma (legacy `[+A-Za-z0-9_]{1,30}` az auth-hoz, UUID az
  üzleti kéréseknél — a kettő felcserélése érvénytelen az XSD szerint),
  bruttó összegű `vatCategory` sorok (nem a régi nettó/ÁFA/bruttó hármas),
  Bearer-tokenes hitelesítés a `/receipt/create`-hez egy valódi
  `/auth/token` cseréből, `validTo`-alapú cache-lejárattal.
- Nem-HUF nyugtanapok **elutasítva, nem kitalálva** — a `receipt` táblában
  nincs tárolt árfolyam, így egy nem-HUF pénznemű csoport `blocked` listára
  kerül `missing_exchange_rate` okkal, `failed` beküldési sort ír magyar
  hibaüzenettel, és megjelenik a nyugta részletező képernyőn ahelyett, hogy
  csendben hibás számot jelentene a NAV felé.
- `getReceiptBaseUrl("production")` mostantól **dob** — nincs ellenőrzött
  éles eNyugta host, és nem is szabad kitalálni egyet.
- Új fájlok: `lib/nav-receipt/{signature,taxpayer,vat-category,response}.ts`,
  `lib/receipts/daily-report.ts`.
- A javító kör (`484cc85`) egy pénznem-csoport keveredést javított a nyugta
  részletező képernyőn (egy HUF sor és egy blokkolt EUR sor ugyanarra a
  napra egymás státuszát/üzenetét mutathatta).
- `db/schema.ts`: **nincs változás** — sem additív, sem destruktív migráció
  ebben a slice-ban.

## Tesztek

- `npx tsc --noEmit` — **zöld** a rekonciliált branch-en (`484cc85` +
  `9484ab9`).
- `npm run test:unit` — **207 suite / 1254 teszt, mind zöld** (teljes
  szvit).
- A terv mind a 20 elfogadási kritériuma (§2) tesztekkel lefedve:
  környezet/mód kezelés, request-id és aláírás generálás, adószám
  normalizálás, XML elem-sorrend és escaping, ÁFA-kategória leképezés, napi
  jelentés csoportosítás (a HUF/EUR-blokkolt szétválasztással együtt), NAV
  válasz-parszolás (névtér-prefix toleráns), auth-token cache/lejárat,
  `/receipt/create` beküldés, az API route-ok (`submit-nav`, cron riport),
  és a nyugta részletező képernyő NAV-kártyájának i18n lefedettsége.

## Findingok (fixed / deferred)

**Ebben a ship-körben talált, nem blokkoló findingok (alacsony
súlyosság) — a `docs/loop-queue.md`-be felvéve, nem javítva ebben a
PR-ban:**

1. **i18n / acceptance** — a `receipts.navMissingExchangeRate` kulcs
   mindkét locale fájlban (`hu.ts:555`, `en.ts:555`) definiálva van, de
   sehol máshol nem hivatkozott. A ténylegesen megjelenő blokkolt-csoport
   üzenet egy hardkódolt, nem lokalizált magyar string
   (`BLOCKED_MESSAGE_HU`), duplikálva az
   `app/api/receipts/[id]/submit-nav+api.ts` és
   `app/api/cron/nav-receipt-report+api.ts` fájlokban, beírva a
   `navReceiptSubmission.errorMessage`-be és változatlanul renderelve (nincs
   `t()` hívás) az `app/(app)/receipts/[id]/index.tsx:201`-ben. Egy angol
   nyelvű felhasználó a nyers magyar mondatot látja a már meglévő angol
   fordítás helyett.
2. **UX** — a nyugta részletező képernyő új NAV-riport-azonosító sora
   megismétel egy már meglévő `selectable` prop konzolhibát weben ("Received
   `true` for a non-boolean attribute"), megegyezően a fájlban néhány sorral
   lejjebb található, változatlan `qrUrl` szöveggel. Nem új regresszió —
   nem blokkoló ebben a PR-ban.

**A javító ügynök által ebben a körben elhalasztott tételek:** nincs új
elhalasztás — az 1. javító kör (`484cc85`) már megoldotta a pénznem-csoport
keveredést a terven belül. Minden, amit a terv maga explicit módon kizárt
(`docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md` §9), tervezett módon
elhalasztva marad: `/receipt/list` és `/receipt/detail` visszaolvasás
(2. slice), storno/helyesbítő a `/receipt/modify` és `/receipt/invalidate`
végponttal (3. slice), az `/issuing-software/create` és `/vat-category/list`
élő lekérdezések, valamint az additív `receipt.exchangeRate` /
`navReceiptSubmission.currency` séma-oszlopok.

**Nyitott kérdések az emberi aláírásra** (terv §8, **nem kódban
megoldandó**): OQ-1 (blokkoló valós használathoz) — a
`NAV_VAT_CATEGORIES` kategórianevek nem ellenőrizhetők a nyilvános repóból
a NAV élő `/vat-category/list`-je vagy a spec §5.9 nélkül, forrásjelölt
konstansként és TODO-val szállítva. OQ-2…OQ-6 — 0%-os ÁFA-sor kategóriája
nem-AAM EV-nél, `numberOfSaleDocument` számlálási szemantikája,
`serialNumber` választása, mindig-nulla `numberOfModifyingDocument` a
storno funkció megérkezéséig, és a nem-HUF napok elutasításának
helyessége a kitalált árfolyam helyett.

## PR

https://github.com/nagybrandy/invohub/pull/17 — cím: "e-nyugta: real NAV
eRECEIPT API — slice 1 of 3 (auth token + /receipt/create + XSD-shaped
payload rebuild)". A `docs/loop-queue.md` tétele `[~] needs sign-off (PR)`
állapotra frissítve mindkét releváns helyen (a rövid prioritás-lista 7.
pontja és a részletes "Remaining for the launch gate" bejegyzés), egy "PR
opened 2026-09-18" jegyzettel és a fenti 2 alacsony súlyosságú follow-up
tétellel kiegészítve.

## Javasolt következő tétel

Szigorúan a Phase 1 prioritás-sorrendet követve a következő nyitott tétel a
8. pont: **invoice-flow tap targetek** — a composer sor-ikon gombjai már
44px-esek (`components/invoices/composer/LineItemRow.tsx`), de az
értesítési harang (`components/navigation/MobileAppHeader.tsx`, ~42px) és
több választó pill (ÁFA-kategória választó, partner-típus pillek,
számlalista szűrő chipek) még 44px alatt van — ez nem tax/legal/NAV-kapuzott,
tehát a Ship-fázis automatikusan mergelheti és deployolhatja, ha zöld és
nincs megmaradó közepes/magas súlyosságú finding.
