# Ship report — backfill-non-huf-invoices-missing-exchange-rate

**Dátum:** 2026-09-18
**Tétel:** Phase 1 — Core invoicing, NAV-compliant, `docs/loop-queue.md`
Prioritás lista 10. pontja. Backfill/surface non-HUF invoices with no
`exchangeRate`: a legacy EUR/non-HUF számlák felszínre hozása, amelyek a
`slice/non-huf-invoice-exchange-rate-nav-xml` előtt jöttek létre, amikor
`POST /api/invoices` csendben eldobta a `body.exchangeRate`-et. Ezeket a
`buildNavInvoiceXml` most helyesen megtagadja NAV felé jelenteni (a korábbi
hardcodolt `exchangeRate=1` helyett). Csak a felszínre hozás fele tartozik
ide — a már NAV-nak jelentett, hibás árfolyammal beküldött számlák
utólagos korrekciója (NAV MODIFY kérdés) explicit módon kimarad, adó-/
jogi-gated, külön tétel (11.).
**Terv:** `docs/plans/2026-09-18-backfill-non-huf-invoices-missing-exchange-rate.md`
(risk: **none** — nincs `lib/nav/`, `lib/tax/`, `lib/m2m/`, `marketing/` vagy
`db/schema.ts` változás).
**Branch:** `slice/backfill-non-huf-invoices-missing-exchange-rate` (a PR
fejcommitja `e2fa4c8`, a build+két fix kör összesített, tesztelt végállapota).
**Bemenő állapot:** Green: false, Gated (tax/legal/NAV-prod): false.

## Eredmény: PR nyitva, nincs merge/deploy

A bemenő állapot szerint ez a ship-kör nem volt végig zöld, ezért a Ship
fázis — a `docs/loop-queue.md`/`CLAUDE.md` workflow-szabálya szerint — nem
mergelt a `main`-be és nem futtatott `vercel --prod`-ot. Helyette PR-t nyitott
emberi review/merge céljából:

**PR:** https://github.com/nagybrandy/invohub/pull/20

`docs/loop-queue.md` 10. pontja `[x]` ("Shipped")-ről `[~]` ("folyamatban —
PR open")-ra lett javítva, mivel a kód még nincs a `main`-en.

### Branch-rekonstrukció megjegyzés

A megadott `slice/backfill-non-huf-invoices-missing-exchange-rate` branch
helyi referenciája elavult volt (`c441da3`, az eredeti build-commit, egy
idle worktree-ban beragadva), miközben két fix kör (`fixround1` →
`fixround2`) már lezajlott ugyanezen a munkán, a build tetejére rebase-elve,
és tartalmazza a teljes, újratesztelt végállapotot. Mivel worktree-izolációs
szabályok tiltják az idegen worktree-ban lévő branch checkoutolását/
force-update-jét, a Ship egy új branch-et (`ship/backfill-non-huf-invoices-
missing-exchange-rate`) hozott létre a `fixround2` csúcsáról egy külön
worktree-ban, ráírta a lenti loop-queue frissítést, majd ezt pusholta fel
`origin`-ra a `slice/backfill-non-huf-invoices-missing-exchange-rate` néven
(a remote-on korábban nem létezett ilyen branch, tehát force nélküli,
egyszerű push történt). A PR ez ellen a fej ellen nyílt.

## Mi shippelt (a PR-ban, mergelésre várva)

- `isMissingExchangeRate` (`lib/invoices/exchange-rate.ts`) — tiszta
  predikátum a meglévő `resolveExchangeRate`-re építve, így nem tud eltérni
  attól, amit a NAV XML builder megtagad.
- `needsExchangeRate` lista-szűrő átvezetve `lib/invoices/list-query.ts`-en,
  az exportált `buildInvoiceListWhere`-en (`lib/invoices/service.ts`,
  SQL-be tolva, nem JS-ben szűrve), a `GET /api/invoices`-en, és a
  `useInvoices`/`useMissingExchangeRateCount` hookokon.
- `ExchangeRateFixBanner` a `/invoices`-on — eldobható, nem-nulla számnál
  jelenik meg, az érintett-only nézetre vált.
- Figyelmeztető kártya a számla-részletező képernyőn, ami közvetlenül a
  composer árfolyam-mezejére linkel (`routes.invoiceEdit(id, { focus:
  "exchangeRate" })`), a már shippelt `StepPartner` fókusz-viselkedést
  újrahasznosítva.
- `POST /api/nav/submit` mostantól típusos 409-et ad (`code:
  "missingExchangeRate"`) kezeletlen 500 helyett, amikor egy érintett
  számlát próbálnak NAV-nak beküldeni.

Sehol nincs kitalált/lekérdezett/alapértelmezett árfolyam — a felhasználó
mindig maga írja be, pontosan úgy, ahogy a composer az új számláknál is
megköveteli.

## Tesztek

- `npx tsc --noEmit` (a PR fejcommitján, a Ship worktree-jában) — **zöld**.
- `npm run test:unit` (ugyanott) — **211 suite / 1307 teszt, mind zöld**.
- A terv mind a 8 elfogadási kritériuma teljesül (plan §2).
- `db/schema.ts` nem változott, nem volt `db:push`.

## Findingok — javítva / elhalasztva

**Ebben a ship-körben kapott két alacsony súlyosságú finding, felvéve a
`docs/loop-queue.md` 10. pontja alá follow-upként (nem javítva ebben a
ship-kommitban — a Ship csak dokumentál/nyilvántart, nem javít
alkalmazáskódot):**

1. **Alacsony / acceptance** — az új `invoices.errors.navMissingExchangeRate`
   i18n kulcs (mindkét nyelven, `hu.ts`/`en.ts`) jelenleg halott kód: a
   composer saját `validateExchangeRateInput` kliensoldali guardja miatt a
   `save()` NAV-submit catch ágának nyers angol `.message` fallback-je ma
   nem érhető el, és a `NavStatusCard.tsx` (ahol ugyanez a minta megvan) nincs
   sehol beépítve a képernyőkbe. **Elhalasztva** — amikor bármelyik útvonal
   elérhetővé válik, `ApiError.code === "missingExchangeRate"` → i18n-kulcs
   leképezést kell hozzáadni (ugyanaz a minta, mint a már felvett
   `receipts.navMissingExchangeRate`-nél).
2. **Alacsony / UX** — a számla-részletező figyelmeztető kártyájának "árfolyam
   hozzáadása" gombján nincs `min-h-11`/`TAP_TARGET_MIN_H`, így kimarad a
   `slice/invoice-flow-tap-targets-44px` által bevezetett 44px tap-target
   minimumból, miközben az `ExchangeRateFixBanner` saját gombja már
   megkapta. **Elhalasztva** — a `TAP_TARGET_MIN_H` hozzáadása ehhez a
   gombhoz egy külön, gyors follow-up.

**Elhalasztva változatlanul korábbi körökből:**

- 11. tétel (NAV MODIFY utólagos korrekció) — adó-/jogi-gated, saját tervet
  és emberi jóváhagyást igényel, nem indult el.

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 1 listáján a következő nyitott, nem gated
Prioritás-tétel a 11. alatti follow-up-ok egyike (pl. a fenti 44px
tap-target finding gyors kiegészítéseként), vagy — ha a csapat a PR-t
hamarosan mergeli — a Phase 1 launch gate-hez tartozó "Remaining for the
launch gate" lista következő nyitott pontja (`docs/loop-queue.md` kb. 660.
sor környékén), mivel a Phase 1 ez a bejegyzés lezárásával közelebb kerül a
launch gate-hez.
