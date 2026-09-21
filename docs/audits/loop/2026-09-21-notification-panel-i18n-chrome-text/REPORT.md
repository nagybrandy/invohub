# Ship report — notification-panel-i18n-chrome-text

**Dátum:** 2026-09-21
**Tétel:** `components/notifications/NotificationPanel.tsx` substantial
pre-existing hardcoded English chrome text ("Notifications", "Mark all
read", "Refresh", empty-state copy, "Just now"/"Xh ago") — left untouched
by a 2026-09-15 i18n fix, ami csak a generált értesítés-*tartalmat*
fordította, nem a panel saját chrome-ját. (2026-09-15 audit, i18n)
**Terv:** `docs/plans/2026-09-21-notification-panel-i18n-chrome-text.md`.
**PR:** https://github.com/nagybrandy/invohub/pull/24 (nincs mergelve —
emberi/product aláírásra vár az AC7 empty-state szövegdöntés miatt)
**Branch:** `slice/notification-panel-i18n-chrome-text`
(origin HEAD ennél a ship-körnél: `0c2973e`)
**Bemenő állapot:** Green: false, Gated (tax/legal/NAV-prod): false.

## Eredmény: a kód már mergelve és éles a `main`-en (PR #23) — ez a ship-kör dokumentum-only, PR-ként nyitva aláírásra, nincs merge, nincs deploy

A tétel kódja (i18n-esített panel-chrome, valódi bezáró gomb, 44px
tap-targetek, `lib/notifications/relative-time.ts`) **már mergelve volt a
`main`-be a #23 PR-en keresztül**, mielőtt ez a ship-kör elindult
(`eabcd7e`, "Merge PR #23: i18n the notification panel chrome + close
button + tap targets"). Ez a ship-kör tehát nem app-kódot szállít, hanem a
két review-kör (round 1, round 2) azon dokumentum-változtatásait, amelyek
soha nem jutottak be a #23-as PR-be, mert azok a #23 mergelése **után**
készültek a branch helyi (nem pusholt) példányain.

### Branch-rekonciliáció

A `slice/notification-panel-i18n-chrome-text` origin-branch a #23
mergelésekor befagyott állapotban maradt (`62871ad`). A branch több helyi
worktree-jében (pl. `wf_e1e48df4-cd1-*`, `wf_7fee7eca-49b-*`) viszont két
további, soha nem pusholt commit élt ugyanazon az ágon:
`f9b1242` ("docs(round1): flag AC7 empty-state copy as needing product
sign-off") és `b6022a8` ("docs(round2): keep AC7 empty-state copy gated for
human sign-off", amely a korábban árva
`docs/plans/2026-09-21-notification-panel-i18n-chrome-text.md` tervfájlt is
a branch-re commitolta). A Ship-fázis ráépítette ezekre a saját
follow-up-commitját (`a990434`), majd egy tiszta, konfliktusmentes merge
commit-tal (`0c2973e`) egyesítette az origin branch aktuális állapotával
(amely közben a #22 PR Button-tap-target-floor reconciliationjét is
hordozza), és ezt pusholta origin-ra. Nem történt force-push, branch-törlés
vagy más destruktív művelet; a `slice/…` branch a saját korábbi
csúcspontjának (`62871ad`) egyszerű, gyors-előre-kompatibilis bővítése.

## Mi shippelt ebben a körben (dokumentum-only, `0c2973e`)

- `docs/plans/2026-09-21-notification-panel-i18n-chrome-text.md` bekerült a
  branch-re (korábban csak egy másik, ehhez a tételhez nem tartozó ágon
  létezett).
- `docs/loop-queue.md`: az AC7 empty-state-szöveg döntés jelölője
  `[~] needs sign-off (PR) (slice/notification-panel-i18n-chrome-text)`-re
  frissült (a repo konvenciója, ld. pl. az e-nyugta tételnél), a hozzá
  tartozó indoklással (round 1 már egyszer, aláírás nélkül módosította ezt
  a szöveget, amit a review megerősített findingként; round 2 tudatosan nem
  döntött róla másodszor egyoldalúan).
- Két, a round 2 review-ban felmerült alacsony súlyosságú finding felvéve
  `docs/loop-queue.md` Phase 1 alá follow-upként (ld. lent) — **nem
  javítva** ebben a körben.

## Miért nem mergelt/deployolt ez a kör

Az AC7 pontosan azt írja elő, hogy az üres állapot leírása "lejárt számlák,
NAV-beküldés, emlékeztetők"-et nevezzen meg. A shippelt szöveg
(`lib/i18n/locales/hu.ts` / `en.ts`
`notifications.panel.empty.description`, commit `2cf14c2`, már a `main`-en)
ehelyett lejárt számlákat, elküldött/fizetésre váró számlákat és
NAV-beküldést nevez meg — mert `syncNotificationsFromDomain`
(`lib/notifications/service.ts:136-181`) soha nem hoz létre
`payment_reminder` bejegyzést, azt kizárólag a demo-only
`seedDemoNotifications` teszi, és `processPaymentReminders`
(`lib/reminders/process.ts`) emailt küld, de sosem hív `createNotification`-t.
Az AC7 szó szerinti szövege tehát nem egyezik azzal, amit az app ténylegesen
csinál.

Ez egy termék-szöveg döntés, nem kódhiba — `tsc --noEmit` és
`npm run test:unit` (a branch története szerint 215 suite / 1367 teszt)
zöld akárhogy is döntünk. Mivel a round 1 már egyszer, emberi aláírás
nélkül módosította ezt a szöveget (és ezt a review megerősített findingként
jelentette), a round 2 explicit módon nem döntött róla másodszor
egyoldalúan. A `CLAUDE.md` munkafolyamat-szabályai szerint ez PR-ként megy
ki emberi aláírásra, nem a dev-loop Ship-fázisának automatikus merge-ére.

Kell az alábbi kettő egyike:
- **(a)** formálisan frissíteni az AC7-et a shippelt, ténylegesen pontos
  szövegre, mivel az emlékeztetők ma nem táplálják ezt a panelt, vagy
- **(b)** valódi `payment_reminder` bejegyzést vezetni be
  `syncNotificationsFromDomain`-ba vagy `processPaymentReminders`-be (ez egy
  önálló TDD-slice, kívül esik ezen a "risk: none" terven), és
  visszaállítani az "emlékeztetők" szót a szövegbe.

## Tesztek

- Ez a ship-kör csak `docs/`-t módosít — nincs kódváltozás, nincs
  típusellenőrzés/teszt-relevancia ebben a diffben.
- A ténylegesen shippelt app-kód (`main`-en, #23 PR) a branch commit-üzenetei
  szerint zöld volt mergeléskor: `tsc --noEmit` és `npm run test:unit`
  (215 suite / 1367 teszt).
- `db/schema.ts` nem változott — nem volt `db:push`.

## Findingok (felvéve `docs/loop-queue.md`-be, nem javítva ebben a körben)

1. **Alacsony — a bezáró gomb `className`-je duplikálja a
   `TAP_TARGET_ICON_BOX` által már biztosított középre-igazítást**
   (`NotificationPanel.tsx:99`):
   `` `items-center justify-center rounded-full ${TAP_TARGET_ICON_BOX}` ``,
   ahol a `TAP_TARGET_ICON_BOX` (`lib/ui/tap-target.ts`) már
   `"h-11 w-11 items-center justify-center"`. Ártalmatlan (a class-merge
   dedupelja), csak zaj a következő olvasónak. Javítás: az explicit
   `items-center justify-center` elhagyása,
   `className={`rounded-full ${TAP_TARGET_ICON_BOX}`}` megtartása.
2. **Alacsony — a tap-target/overflow következtetések csak statikus
   kódolvasással készültek, nem élő renderelt screenshotokkal.**
   A mögöttes kód-szintű állításokat függetlenül ellenőriztük: a `Button`
   `size="sm"` variánsa `min-h-8` (`components/ui/button/index.tsx:53`);
   a `NotificationPanel.tsx:108-124` a `TAP_TARGET_MIN_H`-t (`min-h-11`)
   className-ként alkalmazza a `size="sm"` mellett, amit a tva class-merge
   az override javára old fel; a `DrawerBody`
   (`components/ui/drawer/index.tsx:36`) `ScrollView`-alapú, `shrink-0`
   alap-stílussal, és a `NotificationPanel.tsx:105` `flex-1`-et tart meg a
   `DrawerBody`-n, belső `ScrollView` nélkül. Ezek alátámasztják, hogy
   "kód-szinten nincs regresszió", de a tényleges hitelesített screenshot
   (375×812 / 1440×900) készítését ebben a sessionben blokkolta a
   credential-leakage guard (a repo `.env`-je a production Neon
   `DATABASE_URL`-t tárolja a `CLAUDE.md` szerint), és nem is próbáltuk
   meg — ez egy screenshot-tal még nem igazolt lefedettségi rés, nem egy
   megerősített hiba. Javítás: egy reviewer eldobható helyi Postgres +
   nem-production E2E teszt-felhasználóval készítsen mobil/desktop
   screenshotot, mielőtt ezt teljesen igazolt UX-passzként kezelnénk;
   alternatívaként egy mockolt-auth/Storybook harness építése, hogy a
   `NotificationPanel` élő hitelesítő adatok nélkül is screenshotolható
   legyen.

**A fixer által elhalasztott pont (nem javítva, nem is ebben a körben
döntve):** az AC7 empty-state-szöveg pontossága — ld. fent, "Miért nem
mergelt/deployolt ez a kör".

## Deploy

Nincs deploy ebben a ship-körben (a tétel nincs mergelve — PR #24 nyitva
áll emberi aláírásra). A tétel app-kódja korábban, a #23 PR-en keresztül
már bekerült a `main`-be; ennek a korábbi mergelésnek a production
deploy-státuszát ez a ship-kör nem ellenőrizte (kívül esik a jelen,
dokumentum-only PR hatókörén).

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 1 listáján a következő, nem gated, még
nyitott `[ ]` tétel: "Notification rows created before the 2026-09-15
i18n-key encoding fix ... still render as literal English text" — ez egy
adatmigrációt igényelne a régi sorok visszamenőleges javításához, nem csak
kódváltozást. Alternatívaként a most felvett két alacsony súlyosságú
follow-up egyike (a bezáró gomb redundáns className-je) egy gyors, kis
kockázatú takarítás lenne a következő körben.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
