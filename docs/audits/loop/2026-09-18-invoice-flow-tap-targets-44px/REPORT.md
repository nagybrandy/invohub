# Ship report — invoice-flow-tap-targets-44px

**Dátum:** 2026-09-18
**Tétel:** Invoice-flow tap targets: inline pill buttonok és az
értesítés-harang ≥44px — megosztott "choice pill" primitív (min. 44px), ami
felváltja az ad hoc `Pressable`+`className` mintát az ÁFA kategória/kulcs
pilleken, a fizetési mód/deviza/határidő pilleken, a számla-lista szűrő
chipjein, a composer/bizonylat/képernyőmód taben, és a mobil
értesítés-harangon.
`docs/loop-queue.md`, Phase 1, "Prioritás" lista 8. pontja.
**Terv:** `docs/plans/2026-09-18-invoice-flow-tap-targets-44px.md` (risk:
**none** — tiszta megjelenítési változás, nincs `lib/tax/`, NAV/M2M, adószám,
vagy marketingszöveg érintve, `db/schema.ts` sem változott).
**Branch:** `slice/invoice-flow-tap-targets-44px` (build commit `579743c`,
fix commit `747f167`).
**Bemenő állapot:** Green: true, Gated (tax/legal/NAV-prod): false.

## Eredmény: mergelve és éles telepítve

## Mi shippelt

- Új `lib/ui/tap-target.ts` — egyetlen forrás a 44px minimumra
  (`MIN_TAP_TARGET_PX`, `TAP_TARGET_MIN_H`, `TAP_TARGET_ICON_BOX`).
- Új `components/ui/choice-pill/` primitív (`ChoicePill`/`ChoicePillGroup`),
  szándékosan sima template literal összefűzéssel (nem `tva()`/`twMerge`),
  hogy egy hívó fél ütköző `className`-je ne tudja felülírni a 44px
  minimumot.
- Ez a primitív adja most a `VatCategoryPicker` gyakori/haladó/kulcs
  pilljeit, a `StepPartner` határidő/fizetési mód/deviza pilljeit, a
  `DocumentTypeTabs`/`ScreenModeTabs`/`ComposerStepper` taboket, és az új
  `components/invoices/InvoiceFilterChips.tsx`-t (kiemelve az
  `app/(app)/invoices/index.tsx` korábbi inline `FILTERS.map`-jéből — ez
  mellékesen javította a halott "Egyéb (n)" chipet is, aminek korábban nem
  volt `onPress`-e és megkülönböztethetetlen volt egy működő chiptől).
- `MobileAppHeader.tsx` értesítés-harangja mostantól 44×44px tap-boxot kap
  (`TAP_TARGET_ICON_BOX`) `hitSlop={8}`-cal, a badge újrapozicionálva a
  boxon belül.
- Fix körben (`747f167`): pontosítva a `choice-pill` kód-kommentje (ami
  korábban túlzottan állította a 44px minimum garanciáját), és hozzáadva egy
  valódi CSS cascade tesztet (`tap-target-css-resolution.test.tsx`), ami
  ténylegesen renderelt/számított stílust ellenőriz, nem csak string
  végződést.

## Tesztek

- `npx tsc --noEmit` (main, mergelés után) — **zöld**.
- `npm run test:unit` (main, mergelés után) — **208 suite / 1270 teszt, mind
  zöld**.
- `db/schema.ts` nem változott ebben a slice-ban — nem volt `db:push`.

## Merge megjegyzés

A main-en helyben létezett egy nem pusholt "Plan: invoice-flow-tap-targets-44px"
commit (`9667a54`), ami korábbi (nem-shippelt) állapotot írt le a
`docs/loop-queue.md`-ben ugyanerről a tételről. A branch-mergelésnél ez
konfliktust okozott a loop-queue-ban három helyen; mindhárom esetben a
branch (shippelt, végleges) oldalát tartottuk meg, mivel az írja le a
ténylegesen leszállított állapotot.

## Findingok

**Ebben a ship-körben talált, nem blokkoló findingok (mind alacsony
súlyosság) — felvéve a `docs/loop-queue.md` Phase 1 8. pontja alá
follow-upként, nem javítva ebben a ship-kommitban (a Ship csak
dokumentál/nyilvántart, nem javít alkalmazáskódot):**

1. **`components/ui/choice-pill/index.tsx` kód-kommentje** azt állítja, hogy
   a caller-className-utána-a-base-nak sorrend "mindig nyer" a 44px
   minimumnál, de a teszt csak azt ellenőrzi, hogy a className string
   `TAP_TARGET_MIN_H`-ra végződik — nem a tényleges renderelt/számított CSS
   cascade viselkedést (NativeWind weben a stíluslap szabálysorrendje dönt,
   nem az attribútum string sorrendje azonos specificitású ütközéseknél).
   Fix: pontosítani a kommentet, és egy valódi computed-style/vizuális
   ellenőrzést hozzáadni (pl. a Playwright UX-sweep részeként).
2. **`MobileAppHeader.tsx` új `hitSlop={8}`-ja az értesítés-harangon**
   (a terv AC9 által előírt) most átfedésbe kerül a `LanguageSwitcher`
   már meglévő `hitSlop={8}`-jával a köztük lévő 8px `HStack` résen át —
   kb. 4px széles vitatott érintési sáv, ahol RN hit-testje dönt, nem a
   vizuális közelség. Fix: aszimmetrikus hitSlop a harangon, vagy nagyobb
   rés a két elem között.
3. **A branch egyetlen squashed commit**, így a TDD "előbb bukó teszt"
   sorrend (AGENTS.md §9) git történetből nem igazolható vissza — csak a
   tesztek specifikussága utal rá (pl. a hostile-className cascade teszt,
   a `StepPartner` `exchangeRate` focusField describe blokk). Nem blokkoló;
   jövőbeli slice-oknál érdemes megőrizni a WIP/red-green commitokat, ha ez
   auditálhatóság szempontjából fontos.

**A fixer által tudatosan elhalasztott, nem blokkoló pontok:**

- Nem készült külön `!important`/arbitrary-value (`!min-h-0`,
  `min-h-[0px]`) adversarial teszteset a két meglévőn (hostile `min-h-0` +
  kisebb `py-*` felülírás) felül — ezek már lefedik a cascade-mechanizmust,
  amire a finding vonatkozott; egy szélesebb adversarial-class fuzz teszt
  ésszerű follow-up, de nem ennek a fixnek a hatóköre.
- A feladatban hivatkozott `docs/plans/2026-09-18-invoice-flow-tap-targets-44px.md`
  a branch-ágon (a build/fix agentek nézőpontjából) nem létezett — a fixer a
  finding szöveget és a tényleges `ChoicePill` implementációt/teszteket
  használta hatókörként. (Megjegyzés: a ship-kör mergelésekor kiderült, hogy
  a fájl időközben főágra került egy külön "Plan:" commitban — lásd fent a
  "Merge megjegyzés" részt.)

## Deploy

- `git push origin main`: `7bda7f5..67c8908`
- `vercel --prod --yes`: **READY**
  - `https://invohub-eo70d1hy9-codences-projects.vercel.app`
  - Aliasolva: `https://www.invohub.hu`
- Smoke:
  - `curl https://invohub.vercel.app/` → **200**
  - `curl https://invohub.vercel.app/login` → **200**
  - `PRODUCTION_BASE_URL=https://invohub.vercel.app npm run test:smoke:production`
    → **12/12 teszt zöld** (desktop + mobile projektek)

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 1 "Prioritás" listáján a következő nyitott
tétel a 7. pont, "Nyugta adatszolgáltatás (e-nyugta) NAV API" — jelenleg
PR-ként nyitva emberi aláírásra vár (`slice/e-nyugta-nav-receipt-api`),
tax/legal-gated, nem auto-shippelhető. Az ez utáni első nem gated, nyitott
Phase 1 tétel a "NAV OSA round-trip verification" — érdemes ezt venni a
következő dev-loop körben, vagy a Phase 0 stabilizációs listáról egy
tételt, ha a Phase 1 launch gate köre egyelőre PR-okra vár.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
