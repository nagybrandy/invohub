# InvoHub platform overhaul — végső ellenőrzés (2026-09-14)

Branch: `claude/platform-overhaul` (a `cursor/floating-nav-i18n-fixes`-ből ágazva),
fő checkout: `/Users/brandy/Developer/invohub`. Ez a jelentés az 5 párhuzamos
track (`claude/track-security`, `claude/track-invoicing`, `claude/track-nav`,
`claude/track-landing`, `claude/track-claude-infra`) integrációja, egy
utólagos hibajavító kör (`fix`), majd a mai végső ellenőrzés eredményét
foglalja össze.

## 1. Mit csinált az egyes track

- **track-security** — fail-closed CRON_SECRET a két cron route-on; admin
  jog kiosztás csak CLI-ről (`promote-admin`); demo-adat seed csak explicit
  dupla feature-flaggel (kliens + szerver); regisztrációs `role` mező
  szerver-oldalon védett (`input:false`) — emiatt eltűnt a
  Vállalkozó/Könyvelő választó a regisztrációból (lásd lent, owner döntés
  kell).
- **track-invoicing** — új séma: `document_sequence` tábla + partial unique
  index a sorszámozáshoz, VAT-kategória soronként, fizetés-mezők
  (paymentMethod/paidAt/paidAmount), storno/helyesbítő linkelés
  (originalInvoiceId/modifiesInvoiceId/modificationIndex), `company.vatExempt`.
- **track-nav** — NAV OSA 3.0 teszt-kapcsolat (`nav:check`), M2M szimulátor
  (`m2m:check`), `docs/nav-test-setup.md` teljes lépéslista; a NAV XML
  builder mostantól a `documentType`-ból választja a CREATE/MODIFY/STORNO
  `manageInvoice` műveletet.
- **track-landing** — teljes statikus marketing redesign: EV-út (4 fokozat,
  őszinte "Elérhető/Fejlesztés alatt/Tervezett" státuszok), "Miért InvoHub",
  Árazás, GYIK; lebegő, átlátszó fejléc; a nyelvváltó a jobb szélre került.
- **track-claude-infra** — `docs/CLAUDE.md`, `.claude/skills`,
  `.claude/workflows` (continuous-audit, ship-next), bankpárosítás
  alapkönyvtár (`lib/bank-matching`) — még nincs bekötve UI-hoz.

Az integráció során a NAV XML builder ténylegesen bekötésre került a
számlázás track VAT-kategóriáihoz (AAM/TAM/KBAET/AHK → `vatExemption`,
FAD → új `vatDomesticReverseCharge`, ATK → új `vatOutOfScope`), és a
`manageInvoice` most a helyes CREATE/MODIFY/STORNO műveletet küldi — az XML
törzs `invoiceReferenceData` blokkja MODIFY/STORNO esetén viszont még
hiányzik (lásd 4. pont).

## 2. Utólagos javító kör (fix track)

19 megerősített hiba javítva, köztük: hiányzó i18n 10+ képernyőn (számla-
kártya, ügyfél-szerkesztés, publikus nyugta-nézet, API-kulcsok, PDF
sablon, termékek, import stb.), `KeyboardAvoidingView` hiánya, 44px alatti
törlés-gombok, `Alert.alert` no-op webes megerősítő dialógusoknál (új
`lib/ui/confirm.ts`), részleges fizetés felülírás helyett összegzés,
kontrasztproblémák (WCAG AA), NAV titkok plaintext visszaküldése a
kliensnek (→ redaktált `toPublicCompany()`), nyitott email-relay endpoint
törlése, cross-tenant hibák (NAV-nyugta auth cache, emlékeztető
státusz-felülírás, incoming-sync dedupe hiányzó userId-szűrés), kitalálható
QR-token → kriptográfiailag biztonságos token + rate limiting.

Elhalasztva (dokumentálva `docs/loop-queue.md`-ben): NAV storno/modify XML
`invoiceReferenceData` blokk (valós NAV-XSD nélkül kockázatos találgatni),
a számla-létrehozás mobil UX-e (egy hosszú scroll ~16 mezővel — termék-
döntés), és néhány alacsony súlyú LOW finding (értesítési harang
tap-target, választó pill-ek, stb.).

## 3. Mai végső ellenőrzés eredménye

- **`npm run typecheck`** — 0 hiba.
- **`npm run test:unit`** — **145/145 suite, 690/690 teszt zöld.**
- **Playwright** (`marketing-desktop`, `marketing-mobile`, `chromium`,
  `mobile-chrome`, `E2E_TEST_*` nélkül) — **102 sikeres, 86 skipped, 0
  bukás.** A skipelt tesztek mind az autentikált (bejelentkezést igénylő)
  specek — ezek `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` + éles DB nélkül
  szándékosan és tisztán kimaradnak.
  - Talált és javított hiba: az integráció (`track-landing` merge) két
    duplikált Playwright teszt-blokkot hagyott az
    `e2e/web/marketing.spec.ts`-ben (a "floating header" teszt szó szerint
    duplán, a HU/EN nyelvváltás teszt majdnem duplán), ami miatt a
    Playwright indulás előtt elhasalt ("duplicate test title"). A
    felesleges blokkot eltávolítottam, commitolva
    (`Fix duplicate Playwright test titles from track-landing merge`).

Nagyobb, javítást igénylő regressziót az ellenőrzés nem talált.

## 4. Marketing screenshotok (375px és 1440px)

`docs/audits/2026-09-14/screens/after-375.png` és `after-1440.png`
(statikus szerver a 4396-os porton, a mentés után leállítva).

- **Nyelvváltó jobb szélen**: mobilon a HU/EN kapcsoló a hamburger-menü
  gombtól közvetlenül balra, a fejléc jobb szélén ül; desktopon a
  Belépés/Ingyenes regisztráció gombok után, a legjobboldalibb elem.
  Mindkettő megfelel.
- **Kompakt cookie-sáv**: mobilon 3 soros, ~140px magas kártya, nem takarja
  a hero CTA-t; desktopon egysoros alsó sáv.
- **Hero CTA felül, görgetés nélkül látható** mobilon (375×812): az
  "Ingyenes regisztráció" gomb a viewport tetején, a hajtás felett
  helyezkedik el.

## 5. NAV demo/teszt állapot

- **Demo mód az alapértelmezett** (`company.navEnvironment` default
  `"demo"`) — nincs éles NAV-hívás konfiguráció nélkül.
- **NAV OSA 3.0 (számla-jelentés)**: `tokenExchange` élesben validálva a
  NAV teszt szerver ellen (hamis credentiallel, séma-helyes
  `INVALID_SECURITY_USER` válasszal — ez a request formátumát igazolja).
  `manageInvoice`/`queryTransactionStatus`/`queryTaxpayer` válaszfeldolgozás
  még **nincs** valós NAV válasz ellenében kipróbálva.
- **STORNO/MODIFY jelentés**: a művelet-választás (CREATE/MODIFY/STORNO)
  helyes, de az XML törzsből hiányzik a NAV által megkövetelt
  `invoiceReferenceData` blokk — emiatt egy helyesbítő/sztornó számla NAV
  felé küldése jelenleg valószínűleg elutasításra kerülne. Ez a
  "Production" felé indulás előtti blokkoló.
- **M2M (adóbevallás, Phase 4)**: szimulátor + unit tesztek készen, valós
  m2m-dev.nav.gov.hu ellenőrzés még nem történt.
- **NAV_PRODUCTION_ENABLED**: szerver-oldali kill switch, alapból
  üres/false — az "Éles" opció a UI-n addig mindig letiltva marad.
- Teljes lépéslista a technikai felhasználó/kulcsok beszerzéséhez:
  `docs/nav-test-setup.md`.

## Tulajdonosi teendők (csak Ön tudja elvégezni)

**Vercel / infrastruktúra**
1. `CRON_SECRET` beállítása Vercelen (Production **és** Preview) — mindkét
   cron route (`/api/reminders/run`, `/api/cron/nav-receipt-report`) most
   már fail-closed, CRON_SECRET nélkül minden kérést elutasít.
2. Admin jog kiosztása mostantól csak CLI-vel:
   `DATABASE_URL=<neon connection string> npm run promote-admin -- <email>`
   — a Settings képernyőn és a dev/seed API-n keresztül többé nem lehet
   magadnak admin jogot adni.
3. Demo adat feltöltés (Settings > Demo adatok) csak akkor jelenik meg, ha
   **mind** a kliens (`EXPO_PUBLIC_ALLOW_DEV_SEED=true`), **mind** a
   szerver (`ALLOW_DEV_SEED=true`, és NODE_ENV/VERCEL_ENV ≠ production) be
   van állítva build/deploy időben. Csak dev/preview környezetben, éles
   környezetben soha.

**Adatbázis**
4. `npm run db:generate` (drizzle-kit) már lefutott, a migráció
   `drizzle/0000_platform_overhaul.sql` — ez egy **teljes séma-baseline**
   (soha nem volt `drizzle/` mappa a repóban, korábban `db:push`-sal ment
   szinkronban a Neon DB). Nézd át `docs/decisions/0001-schema-migration.md`-t,
   és a saját Neon adatbázisod állapotától függően vagy futtasd le frissen
   (`db:push`), vagy baseline-old be a migrációt anélkül, hogy újra
   lefuttatná a meglévő táblákon.

**NAV**
5. `docs/nav-test-setup.md` szerint: regisztráció onlineszamla-test.nav.gov.hu-n,
   technikai felhasználó + aláíró/csere kulcs létrehozása, `NAV_SOFTWARE_ID`
   (18 karakter) választása, `NAV_CREDENTIALS_KEY` generálása
   (`openssl rand -base64 32`), majd a `NAV_*` env változók beállítása
   Vercelen (Production + Preview). Ellenőrzés: `npm run nav:check`.
6. STORNO/MODIFY számlák NAV felé küldése előtt a hiányzó
   `invoiceReferenceData` XML blokkot egy valós NAV teszt-fiókkal (vagy a
   XSD ismeretében) kell véglegesíteni — ez jelenleg az egyetlen ismert
   blokkoló a Phase 1 launch gate előtt.
7. (Opcionális, Phase 4-hez) M2M regisztráció m2m-dev.nav.gov.hu-n — a
   portál UI-ja a dokumentálás idején nem volt ellenőrizhető, a lépések
   bizonytalanként vannak jelölve `docs/nav-test-setup.md`-ben.

**Termékdöntések**
8. A regisztrációs "Vállalkozó / Könyvelő" választó eltűnt (biztonsági
   okból, lásd fent) — dönts, hogy szükséges-e visszahozni egy biztonságos
   (pl. admin-jóváhagyásos) formában.
9. Az EV-út "Elérhető" állapotjelzője zöld (paid/success) színt kapott a
   marketing oldalon — `docs/brand.md` a zöldet szigorúan fizetett/sikeres
   pénzügyi állapotokhoz rendeli; ha ez márkaszempontból nem elfogadható,
   szólj és kék/navy jelzésre váltunk.
10. Autentikált E2E tesztek beüzemeléséhez hozz létre egy scratch/dev Neon
    adatbázist és futtasd egyszer:
    `DATABASE_URL=<scratch db> E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run create-test-user`,
    majd exportáld az `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`-t CI-ban
    (GitHub Actions secrets) — ez nincs bedrótozva automatikusan.
11. Fizetési emlékeztetők csak akkor mennek ki, ha az ügyfélnek van e-mail
    címe a törzsadatban — érdemes átnézni a Partnerek listát.
12. A `claude/track-claude-infra` ág PR-ként még nincs megnyitva (nem lett
    push-olva remote-ra) — nézd át és nyisd meg magad, ha kellenek a benne
    lévő workflow scriptek.

## Következő 5 backlog tétel (`docs/loop-queue.md` alapján)

1. **NAV `invoiceReferenceData` blokk pótlása** STORNO/MODIFY számláknál
   (`lib/nav/invoice-xml.ts`) — a Phase 1 launch gate blokkolója.
2. **Autentikált create→preview→PDF E2E teszt** felfűzése, miután a
   scratch-DB + E2E teszt-user rendelkezésre áll (Phase 0 függőség).
3. **AAM/TAM/fordított adózás jogi átvizsgálás** — a számla ÁFA-kezelési
   szövegek és a 0%-os ÁFA logika egyeztetése a
   `.claude/skills/hu-invoicing-rules` skillel jelzett "ellenőrizendő"
   pontokkal, emberi adó-jogi jóváhagyással.
4. **NAV OSA 3.0 valós kliens bekötése** explicit demo/teszt/éles
   mód-választóval a Settingsben (soha nem alapértelmezetten éles) +
   submission-státusz lekérdező UI (elutasítási okok megjelenítése).
5. **i18n gap sweep frissítése** — a `.claude/skills/i18n-sync` skill újra
   futtatása, mert a mai fixer kör lefedte a korábban ismert 9 hiányos
   képernyőt, de a lista azóta változott kódbázis ellenében újra
   ellenőrizendő, mielőtt új hiányokat rögzítünk.
