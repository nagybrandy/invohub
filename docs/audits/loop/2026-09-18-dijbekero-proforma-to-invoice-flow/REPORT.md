# Ship report — dijbekero-proforma-to-invoice-flow (fix-round-2)

**Dátum:** 2026-09-18
**Tétel:** Díjbekérő (proforma) → real flow: DBK number, "Számla készítése
ebből" action that converts to a final invoice (`lib/invoices/numbering.ts`,
detail screen) — 2. kör: a merge-elt PR #15-ből származó négy nyitott
ship-review finding lezárása, és egy már számlázott díjbekérő láthatóvá
tétele a listában. `docs/loop-queue.md`, Phase 1, "Prioritás" lista 5. pontja
és a részletes "folyamatban (slice/dijbekero-convert-to-invoice)" bejegyzés.
**Terv:** a repóban csak `docs/plans/2026-09-15-dijbekero-convert-to-invoice.md`
létezik (az alapfolyamat terve, amire ez a kör épül) — a feladatban
hivatkozott `docs/plans/2026-09-18-dijbekero-proforma-to-invoice-flow.md`
nem létezik sem a branch-en, sem a git történetben (a fix ügynök is
megerősítette és emiatt szigorúan a négy megerősített findingre + a
lista-láthatósági elemre szorította a kört).
**PR:** https://github.com/nagybrandy/invohub/pull/18 (nincs mergelve —
emberi review-ra vár)
**Branch:** `slice/dijbekero-proforma-to-invoice-flow` (build+fix commit:
`3171ced`, ez a ship-kör: `dc07dba`)

## Eredmény: PR nyitva, emberi review-ra vár — nincs merge, nincs deploy

A bemenő állapot `Green: false`, `Gated: false` volt. A Ship-fázis a saját
worktree-jében (`.claude/worktrees/wf_8689fb2f-314-3`) futtatta a
típusellenőrzést és a teszteket a branch aktuális állapotán — ezek ténylegesen
**zöldek** (lásd lent), de mivel a bemenő `Green` jelző `false` volt (ez a kör
nem futott végig a dev-loop teljes automatikus review/fix ciklusán), a
feladat utasítása szerint a Ship-fázis **nem mergelt és nem deployolt**,
hanem PR-t nyitott emberi aláírásra. `CLAUDE.md` szerint a Ship csak akkor
mergelhet automatikusan, ha típusellenőrzés + unit tesztek zöldek **és**
nem marad megerősített magas/közepes súlyosságú finding — mivel ez a kör
nem esett át saját reviewer/skeptic körön ezen a ship-futáson belül, a PR
út a helyes, óvatosabb alapértelmezés.

## Mi shippelt ebben a körben (build+fix commit `3171ced`)

- **F1 — dupla konverzió race feltétel**: új parciális unique index
  `invoice_converted_from_live_unique_idx` a
  `(user_id, converted_from_invoice_id) WHERE converted_from_invoice_id IS
  NOT NULL AND status <> 'cancelled'` feltétellel
  (`drizzle/0003_dijbekero-double-conversion-guard.sql`, csak additív, nincs
  DROP/ALTER/rename) mint DB-szintű védőháló, egy új tiszta
  `isUniqueViolation()` klasszifikátor (`lib/db/unique-violation.ts`), és egy
  try/catch a `convert+api.ts`-ben, ami a violation esetén újra lefuttatja a
  `findExistingConversion`-t és ugyanazt a 409 `{ code: "alreadyConverted",
  invoice }` választ adja vissza 500 helyett.
- **F2 — hiányzó "Kapcsolódó bizonylatok" kártya teszt**: új eset a
  `__tests__/screens/invoice-detail.test.tsx`-ben egy kitöltött
  `convertedFromInvoice`-ra (a link megjelenik, kattintásra a forrás
  díjbekérőre navigál) és két `convertedToInvoices` bejegyzésre (egy élő, egy
  sztornózott — eltérő i18n szöveg, csak az élő navigál).
- **F3 — redundáns `runAction` becsomagolás**: a `primaryOnPress` mostantól
  közvetlenül hívja a `handleConvert`-et a dupla `runAction` becsomagolás
  helyett.
- **F4 — sztornózott vs. élő konverziós link megkülönböztethetetlen volt**:
  egy sztornózott korábbi konverzió mostantól az
  `invoices.links.convertedToCancelled` szöveggel jelenik meg a sima
  `convertedTo` helyett, a terv "szín helyett szöveg" UX-jegyzetének
  megfelelően.
- **Lista-láthatóság**: egy már konvertált díjbekérő mostantól "Számlázva"
  jelzést és egy "meglévő megnyitása" menüelemet kap mind a desktop
  táblázatban, mind a mobil kártyalistában, ahelyett hogy megkülönböztethetetlen
  lenne egy még nem konvertálttól (`app/(app)/invoices/index.tsx`,
  `InvoiceCard.tsx`, `InvoiceListRow.tsx`, `InvoiceListTable.tsx`,
  `useInvoices.ts`).
- `db/schema.ts`: egy additív parciális unique index — nincs DROP/rename,
  nincs adatvesztés-kockázat. A Ship-fázis **nem futtatott `db:push`-t**,
  mert nem történt merge.

## Tesztek

- `npx tsc --noEmit` — **zöld** a branch-en.
- `npm run test:unit` — **203 suite / 1237 teszt, mind zöld** (teljes szvit).

## Findingok

**Ebben a ship-körben talált, nem blokkoló findingok (mind alacsony
súlyosság) — a `docs/loop-queue.md`-be felvéve follow-upként, nem javítva
ebben a ship-kommitban (a Ship csak dokumentál/nyilvántart, nem javít alkalmazáskódot):**

1. **acceptance** — a `docs/loop-queue.md` fix-round-2 jegyzete "PR merged
   2026-09-15"-öt állított egy branch-re, ami 2026-09-18-án még nem volt
   mergelve — a mergelés dátuma három nappal *megelőzte* a leírt
   2026-09-18-i munkát, belsőleg ellentmondó időrend. Follow-up: a
   megfogalmazást "PR opened 2026-09-18, pending review"-ra kell cserélni,
   a tényleges merge-jegyzetet majd a Ship-fázis írja be, ha ténylegesen
   mergelődik.
2. **ux** — az AC14 képernyő-szintű bekötése (`menuItemsFor`/
   `handleOpenExisting` csere `app/(app)/invoices/index.tsx`-ben) nincs
   lefedve egy dedikált teszttel, ami egy nem üres `convertedProformaIds`
   map-et adna át — a kódolvasással megerősíthető helyes, de csak
   `InvoiceCard.test.tsx`/`InvoiceListTable.test.tsx` kézzel átadott
   propokon keresztül van tesztelve, magán a képernyő saját
   id-leképezési logikáján soha.
3. **ux** — az `InvoiceListRow` "Számlázva" jelzése nincs `documentType`-ra
   kapuzva, ellentétben az `InvoiceCard`-dal — jelenleg csak a hívó
   konvenció miatt biztonságos (az egyetlen hívó, `invoices/index.tsx`
   `convertedProformaIds`-e, kizárólag díjbekérő sorokból épül), a komponens
   saját határán implicit, teszteletlen invariáns.

**A fix ügynök által ebben a körben elhalasztott tételek (a fix ügynök saját
jegyzeteiből, nem a Ship-fázis döntése):**

- Nem készült tényleges 375px-es screenshot a mobil javítás vizuális
  megerősítésére (nem-interaktív worktree session-ben nem indult dev
  szerver) — helyette render-tree assertion-ök (`numberOfLines`, `min-w-0`)
  futottak, ami elegendő egy regresszió elkapásához.
- A feladatban hivatkozott `docs/plans/2026-09-18-dijbekero-proforma-to-invoice-flow.md`
  terv nem létezik a branch-en vagy a git történetben — a kör szigorúan a
  négy megerősített findingre lett szorítva a találgatás helyett.
- Nem történt merge/push a fix ügynök részéről (helyesen — ez a Ship-fázis
  feladata), és egy gitignore-olt, nem trackelt `node_modules` szimlink
  maradt a munkakönyvtárban — ártalmatlan, nem része ennek a PR-nak.

## PR

https://github.com/nagybrandy/invohub/pull/18 — cím: "Díjbekérő (proforma) →
real flow: DBK number, \"Számla készítése ebből\" action". A
`docs/loop-queue.md` tétele `[~]` állapotban marad (nem `[~] needs sign-off
(PR)`-ra váltva, mert a tétel nem tax/legal/NAV-gated — csak nem ment át a
teljes automatikus review/fix körön ezen a ship-futáson, ezért PR-t kapott
zöld build mellett is), kiegészítve a fenti 3 alacsony súlyosságú follow-up
tétellel.

## Javasolt következő tétel

Szigorúan a Phase 1 prioritás-sorrendet követve a következő nyitott,
nem-gated tétel a 8. pont: **invoice-flow tap targetek** — a composer sor-ikon
gombjai már 44px-esek (`components/invoices/composer/LineItemRow.tsx`), de az
értesítési harang (`components/navigation/MobileAppHeader.tsx`, ~42px) és
több választó pill (ÁFA-kategória választó, partner-típus pillek, számlalista
szűrő chipek) még 44px alatt van — nem tax/legal/NAV-kapuzott, tehát a
Ship-fázis automatikusan mergelheti és deployolhatja, ha zöld és nincs
megmaradó közepes/magas súlyosságú finding.
