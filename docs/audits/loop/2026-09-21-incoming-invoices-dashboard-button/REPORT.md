# Ship report — Dashboard "Bejövő számlák" gomb félrecímkézés

**Dátum:** 2026-09-21
**Branch:** `slice/incoming-invoices-dashboard-button` → merge `main`-be (`4094145`), plusz egy
follow-up commit (`2690309`)
**Terv:** `docs/loop-queue.md` a `docs/plans/2026-09-21-incoming-invoices-dashboard-button.md`
tervfájlra hivatkozik; az a fájl a végső branch-en nem található (feltehetően a
tervezési lépés nem került commitolásra) — a tényleges indoklás és döntés
`docs/decisions/2026-09-21-no-incoming-invoice-screen-yet.md`-ben van
dokumentálva, ez pótolja a tervet.

## A tétel

A dashboard asztali fejlécén egy "Bejövő számlák" gomb (`app/(app)/dashboard/index.tsx:66`,
`testID="dashboard-incoming-invoices"`) valójában a `routes.invoicesFiltered("unpaid")`-ra
navigált — ez a **kimenő**, kifizetetlen számlák listája, nem a bejövő
(költség)számláké. Közben létezik egy valódi bejövő számla tárolási réteg
(`incomingInvoice` tábla a `db/schema.ts`-ben, `lib/nav/incoming-sync.ts`,
`GET /api/nav/incoming`), amelyhez nem tartozott képernyő.

## Mi készült el

A csapat (implementer) a "relabel vagy építsd meg a képernyőt" választás
helyett egy harmadik, indokolt utat választott, és ezt dokumentálta is
(`docs/decisions/2026-09-21-no-incoming-invoice-screen-yet.md`):

1. **A félrecímkézett gomb eltávolítva**, csere nélkül — az asztali nézeten a
   "Kintlévőség" KPI-kártya már pontosan ugyanoda (kimenő, kifizetetlen
   számlák) mutatott, helyesen címkézve és több információval (összeg +
   darabszám), így egy relabel csak egy harmadik, felesleges vezérlőt hagyott
   volna ugyanarra a listára. A mobil "Új számla" elsődleges gomb
   változatlan.
2. **Nem épült meg a bejövő számlák képernyő ebben a körben.** A
   `GET /api/nav/incoming?sync=true` egyetlen lehetséges adatforrása,
   `fetchIncomingInvoices` (`lib/nav/client.ts`), egy kemény-kódolt demo
   stub, amely nem ér el semmilyen NAV környezetet, és két kitalált
   szállítói számlát ad vissza. Egy képernyő erre építve valós felhasználónak
   mutatott volna fabrikált költségszámlákat — ez rosszabb lett volna, mint a
   félrecímkézett gomb.
3. **`GET /api/nav/incoming?sync=true` lezárva** `isDevSeedAllowed()` mögé
   (ugyanaz az őr, amit az `app/api/dev/seed+api.ts` demo seed már használ) —
   nem engedélyezett környezetben `404 { error: "Not found." }`-ot ad vissza.
   A `requireSession()` továbbra is előbb fut, tehát hitelesítés nélküli
   hívó 401-et kap, nem 404-et; csak a sync ág van letiltva, nem a teljes
   route. A sima `GET /api/nav/incoming` lista ág minden környezetben
   változatlan.
4. Felkerült egy Phase 3 (EV adó) backlog tétel a `docs/loop-queue.md`-be a
   valódi bejövő számla funkcióhoz (NAV OSA `queryInvoiceDigest`
   `invoiceDirection: INBOUND` + `queryInvoiceData` a **test** környezet
   ellen, XML→sor leképezés, lapozás, és/vagy manuális
   költségszámla-rögzítő űrlap) — indokolással, hogy miért Phase 3 alá
   tartozik (elsődleges fogyasztója a költségelszámolás, nem a kimenő
   számlázás).

`lib/nav/` alatt (`incoming-sync.ts`, `client.ts`, `environment.ts`) semmi
sem változott — a döntés kizárólag a route elérhetőségét szűkíti.

## Tesztek

- Új: `__tests__/screens/dashboard/dashboard-header.test.tsx` — asszerálja a
  régi gomb/szöveg hiányát (AC1), és hogy a mobil "Új számla" gomb
  viselkedése változatlan (AC2).
- Új: `__tests__/api/nav-incoming.test.ts` — a `sync=true` ág 404-et ad,
  amikor `isDevSeedAllowed()` hamis, és hogy a hitelesítetlen hívó előbb
  401-et kap.
- Frissítve: `__tests__/screens/dashboard/dashboard-support.test.tsx`,
  `e2e/web/dashboard.spec.ts`, `lib/i18n/locales/en.test.ts` (a
  `dashboard.incomingInvoices` i18n kulcs eltávolítva `en.ts`/`hu.ts`-ből).
- `npx tsc --noEmit`: tiszta.
- `npm run test:unit` a merge után, `main`-en: **225/225 suite, 1488/1488
  teszt zöld**.
- `db/schema.ts` nem változott ezen a branch-en, tehát `db:push` nem
  futott.

## Findingek

**Fixed (ebben a branch-ben, a shipping előtt):** nincs — az implementer
maga a tétel kockázatát (fabrikált szállítói számlák demo stubból) a
tervezés/build fázisban oldotta meg a route lezárásával, mielőtt review-ra
került volna sor.

**Deferred / follow-up ebbe a körbe felvéve:**

1. **(low, process)** Nincs élő Playwright screenshot ehhez a változtatáshoz
   — a review worktree-knek nincs éles Neon `DATABASE_URL`-jük (az csak a fő
   checkoutban létezik), és azt bemásolni a review worktree-be
   production hitelesítő adatokkal futtatna review/teszt forgalmat, amit a
   CLAUDE.md DB szabálya ellenez. Helyettesítő ellenőrzés: `tsc` tiszta,
   `test:unit` 225/225 zöld, és a `components/layout/PageHeader.tsx`
   forráskód-nyomkövetése megerősíti, hogy `primaryAction === undefined`
   esetén nem marad árva gomb-hely az asztali nézeten. Nem blokkolta az
   elfogadást. Felvéve a `docs/loop-queue.md` Phase 0 szakaszába: adjunk a
   review worktree-knek egy nem-production teszt adatbázist, hogy a
   `ux-reviewer`/`continuous-audit` valódi screenshotot tudjon készíteni
   production hitelesítő adatok nélkül.
2. **(backlog, Phase 3)** Valódi bejövő (költség)számla funkció — lásd fent,
   `docs/loop-queue.md` Phase 3 szakasza.

Elutasított/kifogott finding a fixer részéről: nincs (`Deferred by fixer: []`).

## Deploy

- `git push origin main`: `838bec6..2690309`
- `vercel --prod --yes`: **READY**
  - Deployment URL: `https://invohub-by8bpsl7c-codences-projects.vercel.app`
  - Aliased: `https://www.invohub.hu`
- Smoke teszt:
  - `curl https://invohub.vercel.app/` → `200`
  - `curl https://invohub.vercel.app/login` → `200`
  - `PRODUCTION_BASE_URL=https://invohub.vercel.app npm run test:smoke:production`
    → **12/12 teszt zöld** (2.7s, desktop + mobile projekt)

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 0 szakaszában a következő be nem pipált tétel:
**"Auth E2E test user/fixture so authenticated Playwright specs can run"** —
ez közvetlenül megoldaná a fenti #1 follow-up gyökérokát is (hitelesített
Playwright futtatás review worktree-kben), és blokkolja a Phase 1
"create→preview→PDF E2E" tételt is.
