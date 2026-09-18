# Ship report — receipt-blocked-message-i18n-fallback

- **Dátum:** 2026-09-18
- **Fázis:** 1. fázis — alap számlázás, NAV-kompatibilis
- **Ág:** `slice/receipt-blocked-message-i18n-fallback` (alapág:
  `slice/e-nyugta-nav-receipt-api`, **nem** `main`)
- **Terv:** `docs/plans/2026-09-18-receipt-blocked-message-i18n-fallback.md`
- **Backlog tétel:** Ship-review follow-up (low, `slice/e-nyugta-nav-receipt-api`,
  2026-09-18)

## A tétel

A `navReceiptSubmission.errorMessage` mezőbe egy előre legyártott magyar
mondat (`BLOCKED_MESSAGE_HU`) került íráskor, amikor egy nem HUF nyugtacsoport
nem volt jelenthető a NAV felé árfolyam hiányában. Ennek két hibája volt: (1)
angol nyelvű felhasználó is a magyar mondatot látta, mert a nyugta
részletező képernyő nem `t()`-n keresztül renderelte, holott a fordítás
(`receipts.navMissingExchangeRate`) már létezett, csak sehol nem volt
felhasználva; (2) a mondat adatbázis-szintű megkülönböztető kulcsként is
szolgált — a `GET /api/receipts/[id]` pontos szöveg-egyezéssel különböztette
meg a blokkolt nem-HUF sort a HUF sortól ugyanarra a `reportDate`-re, így egy
jövőbeli szövegmódosítás csendben elronthatta volna a nyugtához rendelt NAV
állapotot.

## Mi készült el

- Új `lib/receipts/nav-error-code.ts`: egyetlen kód↔i18n-kulcs leképezés
  (`isNavReceiptBlockedReason`, `navReceiptErrorI18nKey`).
- `app/api/receipts/[id]/submit-nav+api.ts` és
  `app/api/cron/nav-receipt-report+api.ts` mostantól a stabil
  `group.reason` kódot (`"missing_exchange_rate"`) írja `errorMessage`-be a
  törölt `BLOCKED_MESSAGE_HU`/`BLOCKED_EXCHANGE_RATE_MESSAGE_HU` magyar
  szöveg helyett.
- `app/api/receipts/[id]+api.ts` a HUF/nem-HUF sor megkülönböztetést
  `isNavReceiptBlockedReason(row.errorMessage)`-dzsel végzi, nem szöveg-
  egyezéssel — ez egyúttal megszünteti a fenti látens hibát is.
- A nyugta részletező képernyő NAV-státusz blokkja kiemelve az új
  `components/receipts/ReceiptNavCard.tsx` komponensbe, amely ismert
  blokkolási okra `t("receipts.navMissingExchangeRate", { currency })`-t
  renderel, egyébként a NAV saját hibaszövegét változtatás nélkül.
- A `navMissingExchangeRate` fordítási kulcs mindkét nyelven (`hu.ts`,
  `en.ts`) átfogalmazva, hogy interpolálja a `{{currency}}`-t.

## Tesztek

- `npx tsc --noEmit`: tiszta.
- `npm run test:unit`: **209 suite / 1268 teszt, mind zöld** (a ship agent
  saját maga is lefuttatta és megerősítette a PR megnyitása előtt).
- Új/bővített tesztek: `lib/receipts/nav-error-code.test.ts` (új),
  `lib/receipts/daily-report.test.ts` (bővítve),
  `components/receipts/ReceiptNavCard.test.tsx` (új, AC4 lefedésére),
  `__tests__/api/receipts/submit-nav.test.ts` és
  `__tests__/api/cron/nav-receipt-report.test.ts` (a blokkolt eset
  átírva a stabil kódra), `lib/i18n/locales/en.test.ts` (hu/en kulcs-
  parity).
- A terv 6 elfogadási kritériuma (AC1–AC6) mindegyike tesztekkel lefedett —
  részletek a tervben (§2–§3).

## Talált hibák (ship-review, mindkettő low, nem blokkoló)

1. **Vacuous assertion** a `components/receipts/ReceiptNavCard.test.tsx`
   fájlban (~47. sor): `expect(json).not.toContain(">missing_exchange_rate<")`
   soha nem bukik meg, mert a `JSON.stringify(tree.toJSON())` kimenete sosem
   tartalmaz `<`/`>` karaktert (ez JSX/HTML szintaxis, nem JSON). Az előtte
   lévő `toContain("receipts.navMissingExchangeRate")` az egyetlen sor, ami
   ténylegesen fedezi AC4.1-et. **Elhalasztva** — bekerült a
   `docs/loop-queue.md`-be `- [ ]` follow-upként.
2. **UX képernyőkép-készítés nem végezhető el** a review környezetben (nincs
   `DATABASE_URL`/auth adat a review worktree-ban, szándékosan, a
   `CLAUDE.md` szabálya szerint, mely a production Neon URL-t a tulajdonos
   fő checkoutjára korlátozza). Statikus diff alapján megerősítve, hogy az
   új (rövidebb) interpolált string biztonságosan fér el a változatlan
   konténerben. **Nem kódhiba** — bekerült a `docs/loop-queue.md`-be
   `- [ ]` follow-upként, tájékoztató jelleggel.

## Miért nem merge, hanem PR

A tétel **tax/legal/NAV-gated**: NAV nyugta-beküldési viselkedést érint
(`app/api/receipts/**`, `app/api/cron/nav-receipt-report+api.ts`), és egy
olyan szülő ágra (`slice/e-nyugta-nav-receipt-api`) épül rétegzett PR-ként,
amely maga is emberi tax/legal jóváhagyásra vár (OQ-1…OQ-6,
`docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md` §8). A `CLAUDE.md`
szerint a Ship fázis nem merge-eli automatikusan a tax/legal/NAV-gated
munkát — ehelyett PR-t nyit emberi jóváhagyásra, és ezt a PR-t sem szabad a
szülő ág jóváhagyása előtt vagy attól függetlenül mergelni.

Nem történt merge, nem történt `vercel --prod` deploy, nem történt
`db:push` (ez a slice egyáltalán nem érint séma-változást).

## Eredmény

- **PR:** https://github.com/nagybrandy/invohub/pull/19
  (`slice/receipt-blocked-message-i18n-fallback` → alap:
  `slice/e-nyugta-nav-receipt-api`)
- **`docs/loop-queue.md`:** a tétel állapota `[~] needs sign-off (PR)`-ra
  állítva; a 2 low-severity follow-up felvéve `- [ ]` tételként az 1.
  fázisba.

## Következő javasolt tétel

A backlogban a következő nem-gated, nyitott (`[~] folyamatban`) tétel a
`slice/dijbekero-convert-to-invoice` PR-jának review-lezárása, vagy — ha a
tulajdonos inkább a gated láncon akar előrehaladni — az
`slice/e-nyugta-nav-receipt-api` és az erre épülő ez a PR emberi
jóváhagyása, hogy a következő dev-loop kör már `main`-ből tudjon dolgozni
a nyugta-modulon.
