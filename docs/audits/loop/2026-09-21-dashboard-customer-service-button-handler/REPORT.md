# Ship report — dashboard-customer-service-button-handler

**Datum:** 2026-09-21
**Fazis:** 0 — Stabilization (cross-cutting UX finding, nem fazis-specifikus)
**Backlog tetel:** `docs/loop-queue.md` — "Dashboard \"Customer service\"
button (`app/(app)/dashboard/index.tsx`) has no `onPress` handler, unlike
the neighboring incoming-invoices button — wire it to a support contact
flow (mailto, chat widget, help page) or remove it until one exists"
(2026-09-14 audit, ux-desktop)
**Terv:** `docs/plans/2026-09-21-dashboard-customer-service-button-handler.md`
**Branch:** `slice/dashboard-customer-service-button-handler` -> mergelve a
`main`-be (merge commit `dd0db48`, no-ff)

## A problema

A dashboard fejlecen az "Ugyfelszolgalat" (customer service) gomb a
szomszedos "bejovo szamlak" gombbal ellentetben nem kapott `onPress`
kezelot — nyomva semmi nem tortent, holt UI elem maradt a felhasznalo
szamara.

## Mi keszult el

- Uj `lib/support/contact.ts` modul: a support-gomb viselkedeset egy
  `EXPO_PUBLIC_SUPPORT_EMAIL` kornyezeti valtozo vezerli. Ha nincs
  beallitva, a gomb (es a mogotte allo trigger) teljesen rejtve marad —
  nincs felig-kesz UI. Ha be van allitva, a gomb egy `mailto:` linket nyit
  meg `Linking.openURL`-lel.
- `app/(app)/dashboard/index.tsx`: a gomb most mar mobilon is elerheto
  (korabban csak desktopon jelent meg), es `Linking.openURL` sikertelen
  hivasa eseten helyi toast hibauzenetet mutat a felhasznalonak.
- `components/layout/PageHeader.tsx`: uj opcionalis `overflowLabel` prop
  (alapertelmezett: "Tovabbiak"), igy a tobbi-menu trigger akadalymentes
  (a11y) cimkeje mostantol `t("nav.more")` forditasi kulcson keresztul jon,
  nem egy be-hardkodolt magyar string.
- `.env.example`: dokumentalva az uj `EXPO_PUBLIC_SUPPORT_EMAIL` valtozo,
  es a build/bundle-oldali javitas, hogy Metro/EAS bundlek is lassak
  (kulon commit: `3fa2747`).
- Uj forditasi kulcsok: `lib/i18n/locales/en.ts` es `hu.ts` (+6-6 sor).
- `docs/loop-queue.md`: az eredeti tetel `[x]`-re jelolve, a fenti
  megvalositas rovid osszefoglalojaval.
- Nincs `db/schema.ts` valtozas ebben a szeletben.

## Tesztek

- Uj unit/komponens tesztek: `lib/support/contact.test.ts` (107 sor),
  `__tests__/screens/dashboard/dashboard-support.test.tsx` (250 sor),
  `components/layout/PageHeader.test.tsx` bovitese (+19 sor).
- Ship elott a `main`-en (a merge utan) lefuttatva:
  - `npm run typecheck` — zold, hiba nelkul.
  - `npm run test:unit` — **223/223 test suite, 1479/1479 teszt zold.**
- `db/schema.ts` nem valtozott ebben a szeletben, `db:push` nem volt
  szukseges.

## Talalt, de nem blokkolo hianyossagok

Ebben a menetben nem erkezett uj alacsony sulyossagu (`low`) megallapitas
a fixer/reviewer korbol (ures lista), igy a `docs/loop-queue.md` nem
kapott uj kulon "follow-up" bejegyzest ebbol a ship menetbol — a tetel
maga mar a branch-en `[x]`-re lett pipalva a fenti reszletezessel.

A fixer/tervezo altal mar korabban elhalasztott, terv szerint kivul eso
tetelek (nem ebben a menetben kerulnek megoldasra):

- Az imprint oldal `[KITOLTENDO]` (TODO) helykitoltoi.
- A felreert cimkeju "Bejovo szamlak" gomb.
- Kozos/megosztott toast provider hianya (jelenleg helyi toast-megoldas
  keszult a support-gombhoz).
- A `PageHeader` teljes szeles koru `useTranslation` migracioja.

## Deploy

- `git push origin main`: `8f1dff5..dd0db48`
- `vercel --prod --yes`: production deployment
  `https://invohub-fj5dfby3e-codences-projects.vercel.app`
  (`dpl_AhBFH7aNun15AukLTXndCLo6BuxE`), aliasolva `https://www.invohub.hu`-ra.
- Smoke teszt:
  - `curl https://invohub.vercel.app/` -> 200
  - `curl https://invohub.vercel.app/login` -> 200
  - `PRODUCTION_BASE_URL=https://invohub.vercel.app npm run test:smoke:production`
    -> **12/12 teszt zold** (desktop + mobile projektek, health endpoint,
    statikus marketing assetek, entry JS bundle, fooldal, login oldal, CTA
    navigacio).

## Kovetkezo javasolt tetel

A `docs/loop-queue.md` Phase 0 — Stabilization szekcioban a legfelso meg
nem kezdett (`[ ]`) tetel: **"Reminders cron reliability — confirm
`app/api/cron`/`app/api/reminders` + `lib/reminders/process.ts` handle
retries and partial failures, not just the happy path."** (A legelso
tetel, "Seed/demo data and admin-endpoint security audit", mar
`[~] folyamatban` allapotban van a `slice/seed-demo-data-admin-endpoint-security-audit`
branch-en.)

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
