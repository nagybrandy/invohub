# InvoHub — app UX/UI overhaul (2026-09-14/15)

Branch: `ux/app-overhaul-2026-09-14`, fő checkout: `/Users/brandy/Developer/invohub`.
PR: https://github.com/nagybrandy/invohub/pull/11 (nincs mergelve — owner
review vár rá).

Owner brief (2026-09-14 este): *"On desktop the app has a lot of UX/UI
problems — invoice creation is complicated, it is hard to see what is
where, the in-app menu is not clear, and it is not pretty. Fix these
first."* Desktop (1440×900) elsőbbséget élvez, de mobil (375×812) nem
romolhat.

Ez a workflow (`.claude/workflows/app-ux-overhaul.js`) 4 párhuzamos track-re
bontva, egy megelőző audit (`docs/design/app-ux-audit-2026-09-14.md`) és egy
ebből épített terv (`docs/design/app-ux-spec-2026-09-14.md`) alapján
dolgozott, majd egy integrációs/hibajavító körrel zárult ezen a branch-en.
A `docs/loop-queue.md` Prioritás listájának 0. tétele (App UX/UI overhaul),
valamint az általa elnyelt 1. (mobil lépés-flow a számlakészítésben) és 8.
(üres állapot CTA) tétel ezzel lezárva.

## 1. Mit csinált az egyes track

- **visual** (`d359788`) — megosztott alap az összes többi tracknek:
  térköz-skála, tipográfia (Ranade fejlécek), felület/szegély/árnyék
  tokenek, egy közös státusz-szín forrás, gomb-hierarchia (V9), üres/
  betöltő/hiba állapot komponensek (`StateView`), megosztott `DataTable`.
- **shell** (`191b3b3`) — desktop oldalsáv navigáció + oldalfejléc "topstrip",
  mobil alsó tabsor + FAB ("+" gomb), az információs architektúra
  tisztázása (mi hol van).
- **invoice-create** (`0dfa89e`) — a számlakészítés teljes újratervezése:
  a régi egy hosszú, ~16 mezős scroll helyett megosztott 3-lépéses
  composer (Partner → Tételek → Ellenőrzés & küldés), amit `/invoices/new`
  és `/invoices/[id]/edit` egyaránt használ. Desktopon 2 oszlop (form +
  állandó összesítő/előnézet panel), mobilon egyszerre egy lépés, ragadós
  összesítő sávval.
- **lists** (`d71e00b`) — desktop táblázatok + keresés/szűrés/sor-menü a
  Számlák/Partnerek/Termékek/Nyugták listáknál, vezérlőpult kattintható
  KPI-kkal és valós bevétel-diagrammal.
- **integrációs javítások** (`22b3db6`, `1178924`, `5141a07`, `4fcd341`,
  `502fcae`, `3cb7395`, `559db0c`) — beágyazott `<button>` DOM-hiba a
  megosztott `DataTable` sorban, `numberOfLines` DOM-prop szivárgás,
  `jest.config.js` a `.claude/worktrees/`-t figyelmen kívül hagyta (emiatt a
  worktree-kben futó tesztek nem futottak le a fő checkoutból), "Összes"
  szűrő-chip hibás száma, sor-túlcsordulás menü portálozása webre, egy
  auth-fixture-höz nem illő viewport-felülírás törlése a Playwright
  specekből, Partners/partners.* terminológia egységesítése.

## 2. Előtte / utána

| Képernyő | Előtte | Utána |
| --- | --- | --- |
| Vezérlőpult (desktop) | `docs/design/screens/2026-09-14/01-dashboard-1.desktop-1440x900.png` | `docs/design/screens/2026-09-14-integrated/dashboard-desktop-1440x900.png` |
| Vezérlőpult (mobil) | `docs/design/screens/2026-09-14/01-dashboard-1.mobile-375x812.png` | `docs/design/screens/2026-09-14-integrated/dashboard-mobile-375x812.png` |
| Új számla (desktop) | `docs/design/screens/2026-09-14/05-invoice-new-a-empty-1.desktop-1440x900.png` | `docs/design/screens/2026-09-14-integrated/invoices-new-desktop-1440x900.png` |
| Új számla (mobil) | `docs/design/screens/2026-09-14/05-invoice-new-a-empty-1.mobile-375x812.png` | `docs/design/screens/2026-09-14-integrated/invoices-new-mobile-375x812.png` |
| Számlalista (desktop) | `docs/design/screens/2026-09-14/02-invoices-list-1.desktop-1440x900.png` | `docs/design/screens/2026-09-14-integrated/invoices-desktop-1440x900.png` |
| Partnerek (desktop) | *(nem volt külön audit-kép)* | `docs/design/screens/2026-09-14-integrated/clients-desktop-1440x900.png` |
| Beállítások (desktop) | `docs/design/screens/2026-09-14/20-settings-index-1.desktop-1440x900.png` | `docs/design/screens/2026-09-14-integrated/settings-desktop-1440x900.png` |

Az "utána" képek a teljesen integrált (mind a 4 track + javítások) branch-ről
készültek, a `559db0c` commit része.

## 3. Mai ellenőrzés eredménye

- **`npm run typecheck`** — 0 hiba.
- **`npm run test:unit`** — **186/186 suite, 950/950 teszt zöld.**
- **Manuális smoke-teszt** — saját `npx expo start --web --port 8123`
  példányon, a seedelt E2E teszt-fiókkal bejelentkezve: `/dashboard` (új
  oldalsáv shell, valós KPI kártyák, bevétel-diagram) és `/invoices/new`
  (új 3-lépéses composer, ragadós összesítő/előnézet panel) mindkettő
  hibátlanul betöltött, a hálózati kérések mind 200 OK-t adtak vissza.
- Deploy nem történt ebben a workflowban (csak branch + PR, owner review
  vár rá) — `deployUrl` nincs.

Nagyobb regressziót az ellenőrzés nem talált.

## 4. Javított / elhalasztott hibák

### Ebben a körben javítva

- Beágyazott `<button>` a megosztott `DataTable` sorban (React DOM hiba a
  `/clients` oldalon élőben megerősítve) — a `accessibilityRole="button"`
  eltávolítva a kattintható sor `Pressable`-jéről, ugyanaz a minta, mint az
  `InvoiceListRow`/`InvoiceCard`-nál korábban.
- `jest.config.js` a `.claude/worktrees/`-t globálisan ignorálta, ami egy
  worktree-ből futtatva a saját teszteket is kihagyta.
- "Összes" szűrő-chip hibás száma a számlalistán + sor-túlcsordulás menü
  portálozása webre (elakadt/vágott menü).

### Alacsony súlyú (LOW) találatok — új tételek a `docs/loop-queue.md`-ben

1. **A kimenő bizonylat-előnézet/PDF továbbra is angol és márkajelzés
   nélküli** (`lib/invoices/preview-html.ts`). Élőben megerősítve: a
   composer ragadós mini-előnézete és a véglegesített számla "Előnézet"-je
   is "DRAFT", "Status: unpaid", "Bill to:",
   "Description/Qty/Unit/VAT/Total" angol szöveget renderel, InvoHub
   márkázás nélkül. A spec §8 már eleve kizárta ezt a workflow hatóköréből,
   de a composer redesign óta ez a panel a számla minden képernyőjén
   állandó oldalsávban látszik (nem egy külön előnézet fülön), ezért
   láthatóbbá vált. **Ajánlott a következő queue-tétel legyen.**
2. **A Ranade 500-as vastagság sosem kerül ténylegesen használatra**,
   ezért a spec AC4 e2e-elvárása (`document.fonts.check('500 16px
   Ranade') === true`) teljesíthetetlen a jelenlegi kódban — minden
   fejléc `font-bold`/`font-semibold` párosítással hívja a
   `font-heading`-et, és a megosztott `Heading` alapstílus
   (`components/ui/heading/styles.tsx`) mindig `font-bold`-ot ad hozzá.
   Nincs látható UI-hiba (a ténylegesen használt Ranade 700 betölt és jól
   renderel), ez egy spec/teszt-írási következetlenség, nem regresszió.

### Elhalasztva (nem ebben a körben)

- A composer sor-komponense 1440 px-en még mindig saját belső vízszintes
  görgetést igényel, hogy mind a 8 oszlop kiférjen a fix 400 px-es
  összesítő panel mellett (~680 px elérhető hely a spec 8-oszlopos,
  legalább 1068 px-t igénylő elrendezéséhez, beleértve a leírás mező 240
  px-es minimumát). Ennek teljes megszüntetése nagyobb átalakítást
  igényelne (pl. az összesítő panel szélessége, vagy a sor szerkezetének
  átalakítása — pl. Nettó/Bruttó egy oszlopba vonása) — egy szűkebb 2.
  körös javításnál nagyobb feladat, külön queue-tételbe került.
- `components/notifications/NotificationPanel.tsx` jelentős, korábbról
  itt maradt, hardkódolt angol chrome-szöveget tartalmaz ("Notifications",
  "Mark all read", "Refresh", üres-állapot szöveg, "Just now"/"Xh ago") —
  ez különbözik attól a konkrét, generált-tartalom i18n-hibától, amit egy
  korábbi kör javított, és ebben a körben érintetlenül maradt.
- A 2026-09-15 i18n-kulcs-kódolási javítás előtt (ugyanabban az adatbázisban,
  korábbi teszt-futtatásokból) létrejött értesítés-sorok továbbra is szó
  szerinti angol szövegként jelennek meg — szándék szerint csak az
  újonnan szinkronizált/seedelt értesítések kapják meg a javítást. Ehhez
  adatmigráció kellene, nem csak kódváltoztatás, ha a régi sorokat is
  helyesen kell megjeleníteni.

Az item 7 (harang + választó pill-ek ≥44px tap-target) **részben** teljesül:
a composer saját sor-ikongombjai már 44×44 px-esek
(`components/invoices/composer/LineItemRow.tsx`), de az
`MobileAppHeader.tsx` értesítés-harangja (~42 px) és több választó pill
(ÁFA-kategória picker, partner-típus pill-ek, számlalista szűrő chip-ek)
még 44 px alatt van — ez a tétel nyitva marad a `docs/loop-queue.md`-ben.

## 5. Amihez nem nyúltunk

NAV/M2M éles működés, adó-számítási logika, `db/schema.ts` — a workflow
kifejezett tiltása szerint, egyik track sem érintette ezeket.

## 6. Következő lépés

Owner review a PR-en (#11); merge után a `docs/loop-queue.md` Phase 1
soron következő tétele a kimenő bizonylat-előnézet magyarítása/márkázása
(1. LOW találat fent), majd a nyitva maradt tap-target tétel (item 7).
