# InvoHub — teljes UX/UI felülvizsgálat és funkcióhiány-elemzés, 2026-09-28

**Kinek szól:** a tulajdonosnak, döntéshez. A kérdés, amire válaszol: *mi kell
még ahhoz, hogy egy magyar egyéni vállalkozó ma erre az appra bízza a
számlázását — és mi az, ami „csak" kényelmetlen?*

**Módszer.** A teljes bejelentkezett app végigjárása a friss `main`-en, valódi
Chrome-mal (Playwright, `channel: "chrome"`), valódi belépéssel az E2E
fiókba, két nézetben: 1440×900 és 375×812. Képernyőnként mérve: konzolhiba,
vízszintes túlcsordulás, 44 px alatti érintési célpontok, elsődleges gomb a
hajtás felett, első betöltés ideje, a látható szöveg (üres állapotok, másolat)
és képernyőkép. **50 felvétel**, 25 útvonalon. Minden számhoz, ami a
képernyőn szerepel, a „címke-igazság" ellenőrzés: ugyanazt a figurát SQL-lel
kiszámoltam az adatbázisból, és összevetettem. Ahol a képernyő nem elég, a
kódot olvastam, és minden állításnál megnevezem a fájlt.

**Ami nem került bele, és miért.** Az értesítési panelt a gomb-választóm
elvétette (a banner „+8 további értesítés" gombját találta el), ezért az ott
mért elemek a vezérlőpultéi — a panelre a meglévő backlog-tételt hivatkozom,
újra nem ellenőriztem. A vadonatúj fiók üres állapotait nem néztem élőben (a
teszt-fiókban mindenhol van adat); a másolatot kódból olvastam. A számla
*létrehozását* kihagytam — azt a 2026-09-23-i kör épp most rakta rendbe.

---

## 1. Mi blokkolja a valódi használatot

Az az EV, aki havi 5–40 számlát állít ki és egy NAV-ellenőrzést túl kell
élnie, ma **három okból nem tudja** erre bízni a vállalkozását. Mind a három
más természetű: az egyik a termék hiánya, a kettő a meglévő termék
félrevezetése.

### 1.1 Az éles NAV-jelentés nem létezik — és ezt a felület nem mondja ki

`lib/nav/environment.ts:33-35` szó szerint: *„silently falls back to demo for
production when the server hasn't explicitly enabled it"*. Ha valaki
„Éles"-re állítja a NAV módot, és a szerveren nincs `NAV_PRODUCTION_ENABLED`,
a számlái **egy beépített szimulátorba** mennek, és a felület ezt nem
különbözteti meg a valódi beküldéstől. Ehhez jön, hogy a teszt-környezeti
körbejárás (valódi `manageInvoice` oda-vissza) a `docs/nav-test-setup.md`
és a 2026-09-23-i élő mérés szerint **sosem futott le sikeresen** — a közös
teszt-fióknak hiányzik a cserekulcsa.

Következmény: ma az InvoHub egy **sorszámozó-és-PDF eszköz**, amit egy
NAV-ellenőrzés nem fogad el. Ez a Phase 1 kapuja, és **tulajdonosi + jogi
jóváhagyáshoz kötött**, nem mergelhető automatikusan. Nem UX-kérdés, de ez
az első sor, mert minden más ez alá rendeződik.

### 1.2 A NAV-állapot ott láthatatlan, ahol az EV nézi

`components/invoices/InvoiceListRow.tsx:110-112`: a lista NAV-pöttye
`finalized ? bg-primary : muted` — **a státusztól függetlenül** kék minden
véglegesített számlán, és a hozzá tartozó segédszöveg neve
`navSubmittedHint`. Élőben: az `INV-2026-00002` (amit szeptember 23-án
állítottam ki, és amiről tudom, hogy `navSubmissions: []`) **kék pöttyel**
szerepel a vezérlőpulton és a listán is — a részletezőn ugyanekkor „Nincs
beküldve". Egy sikertelen beküldés csak úgy derül ki, ha valaki egyenként
megnyitja a számlákat. A „Következő lépések" kártya (2 lejárt, 6
piszkozat) egyáltalán nem tud NAV-hibáról.

### 1.3 A számok, amikre az EV dönt, nem azt jelentik, amit a címkéjük mond

Két helyen mértem, mindkettő hamis volt. A vezérlőpultét ebben a körben
kijavítottam (lásd 3.1); a listáé nyitott.

| Képernyő · címke | Amit mutatott | Valós érték | Ok |
|---|---|---|---|
| Vezérlőpult · „E havi bevétel" | 232 220 Ft | **0 Ft** | minden idők kifizetett bruttója, dátumszűrés nélkül (`lib/dashboard/summary.ts`) |
| Vezérlőpult · „Becsült fizetendő ÁFA" (III. negyedév) | 49 370 Ft | **86 697 Ft** | minden idők *kifizetett* számláin, pedig a segédszöveg „kiállított" alapot ígért — 43%-kal alábecsülte a félreteendőt |
| Számlák · „E havi kiállított összeg" | 451 584 Ft / 10 db | **4 890 Ft / 3 db** | `lib/invoices/service.ts:129-136` — nincs státusz/típus-szűrő, tehát **6 piszkozat és 1 díjbekérő** számít „kiállítottnak" |

Egy piszkozat definíció szerint nincs kiállítva. Az EV ezekre a számokra
nézi az AAM-határt és azt, mennyit tegyen félre.

### 1.4 (Ráadás) 30 számla után a lista véget ér

`lib/invoices/constants.ts:4`: `INVOICE_LIST_LIMIT = 30`, és a
`hooks/useInvoices.ts` / a lista képernyő **nem használ** `offset`-et,
`loadMore`-t vagy `hasMore`-t. Ami a 30. után van, az a felületről
**elérhetetlen** — a teszt-fiók 17 számlájával nem látszik, egy havi 5–40
számlás EV a második hónapban beleszalad. Nincs év/hónap szűrő sem, ami
kerülőút lehetne.

---

## 2. Képernyőnkénti UX-megállapítások

Súlyosság: **MAGAS** = félrevezet vagy elzár; **KÖZEPES** = lassít vagy
zavar; **ALACSONY** = csiszolás.

### 2.1 Vezérlőpult (`/dashboard`)

- **(MAGAS, javítva) A két időszakos KPI hamis volt** — lásd 1.3 és 3.1.
- **(MAGAS) A „Legutóbbi számlák" NAV-oszlopa hazudik** — lásd 1.2.
- **(KÖZEPES) A „Következő lépések" nem ismeri a NAV-hibát.** Csak „lejárt"
  és „piszkozat" sort ad; egy elutasított/ABORTED beküldés nem kerül elő.
- **(ALACSONY) „Bevétel statisztika" sáv** — ha semmi sincs kifizetve, egy
  100%-os kék csík a teljes tartalom. Működik, de nem mond semmit.
- Mobil: az „Új számla" a hajtás felett ✓; a 4. KPI-kártya lelóg, de
  görgethető.

### 2.2 Számlalista (`/invoices`)

- **(MAGAS) „E havi kiállított összeg" piszkozatot és díjbekérőt is összead**
  — 1.3.
- **(MAGAS) 30 számla feletti rész elérhetetlen** — 1.4.
- **(MAGAS) A NAV-pötty státuszvak** — 1.2.
- **(KÖZEPES) Mobilon a lista első sora a hajtás alatt van.** 375 px-en: 3
  statisztikakártya + a piros árfolyam-banner + kereső + szűrőchipek ≈ egy
  teljes képernyő, mielőtt az első számla látszana (`mobile-invoices.png`).
- **(KÖZEPES) Az árfolyam-banner tartós és hangos.** „11 deviza számlához
  nincs rögzítve HUF-árfolyam" — a 17-ből 11 (importált EUR-piszkozatok).
  Jogos figyelmeztetés, de minden listanyitáskor egy piros doboz, amíg
  valaki ki nem takarítja. Egy „nem érdekel most" vagy a piszkozatok
  kizárása enyhítené.
- **(ALACSONY) „Egyéb (2)" chip** — a sztornózott és a díjbekérő kerül alá;
  a név nem mondja meg, mi van benne.
- **(ALACSONY) Üres állapot másolata** (`hu.ts:201`): „…vagy tölts be demo
  adatokat a Beállításokból" — a gomb `EXPO_PUBLIC_ALLOW_DEV_SEED`-hez
  kötött (`settings/index.tsx:79`), élesben **nincs ott**. Egy új
  felhasználó egy nem létező gombhoz lesz irányítva.

### 2.3 Számla részletező (`/invoices/[id]`) — 7 státusz/típus megnézve

Alapvetően jó: egy szilárd elsődleges gomb státuszonként (fizetetlenre
„E-mail emlékeztető"), idővonal, a NAV-sor **a PDF felett**, tehát egy
ellenőr görgetés nélkül látja a sorszámot, a dátumokat és a NAV-státuszt —
ezt a brief „jó"-nak nevezte, és teljesül.

- **(KÖZEPES) A teljesítés dátuma sehol nem jelenik meg.** `fulfillmentDate`
  0 találat az `[id]/index.tsx`, `InvoiceTimeline.tsx`,
  `InvoiceMoneyHeader.tsx` fájlokban. Az idővonal „Kiállítva → Kiküldve →
  Esedékes → Fizetve". A teljesítés dátuma a NAV-nak megy és ellenőrzési
  szempontból kötelező adat — a felületen nem látni.
- **(ALACSONY) Mobilon a „Kinyitás" sor 309×36 px** — 8 px-szel a 44-es
  padló alatt, minden státuszon.

### 2.4 Beállítások — hub és Céges profil

- **(KÖZEPES) Az adóhatósági XML-export „Eszközök és beállítások" alá
  szorult**, a nyelvváltó és az API-kulcsok után. Ez az app
  ellenőrzés-szempontból legfontosabb funkciója, és a hub aljára került.
- **(ALACSONY) A hub kártyasorrendje** nem használati gyakoriság szerinti:
  „API kulcsok" és „PDF megjelenés" a „Céges profil" mellett.
- A Céges profil rendben: adószám mellett „Keresés" (NAV-lekérdezés),
  „Alanyi adómentes" kapcsoló, világos szekciók. Az „Éles" NAV mód
  tiltottságának magyarázata admin-ízű (`productionDisabledHint`), egy
  EV nem tudja belőle, hogy **most szimulátorba számláz** — lásd 1.1.

### 2.5 Onboarding (`/onboarding`)

- **(KÖZEPES) Nem kérdezi meg, hogy alanyi adómentes-e.** `vatExempt` /
  „Alanyi" **0 találat** az `onboarding.tsx`-ben, miközben a Céges profilban
  ott a kapcsoló. Egy AAM-es kezdő az első számláját 27%-os alapértékkel
  kezdi, amíg meg nem találja a beállítást — pont az a hiba, amit egy
  könyvelő az első héten visszadob.
- Egyébként tiszta: kötelező mező jelölve, adószám-formátum segédszöveg,
  haladásjelző.

### 2.6 Partnerek, Termékek, Nyugták — röviden

- Partnerek: a listán van adószám, e-mail, város; az űrlapon **nincs
  NAV-lekérdezés** (a Céges profilon van), és nincs link a partner számláira.
  (KÖZEPES — minden új partnernél kézi gépelés.)
- Termékek: a seed-adat árai (45 Ft/óra, 29 Ft/hó) nyilvánvalóan
  EUR-értékek HUF-ként — a `COMPANY_CURRENCY = "HUF"` beégetés Fable
  megfigyelése, itt látszik. (ALACSONY, teszt-adat; de a mögötte lévő
  pénznem-feltételezés valódi.)
- Nyugták: **1 konzolhiba** a részletezőn — `Received true for a
  non-boolean attribute selectable` — a `docs/loop-queue.md:1204` tétel,
  még mindig él. A lista és az új nyugta képernyő tiszta.

### 2.7 Keret: banner, célpontok, sötét mód

- **(KÖZEPES) Sötét mód: bekötve, de elérhetetlen.** A provider figyeli a
  `prefers-color-scheme`-et (`gluestack-ui-provider/index.web.tsx:61`), a
  `lib/useColorScheme.tsx` tárolt preferenciát olvas — mégis, sötét
  rendszerbeállítással (`mediaDark: true`) az app `htmlClass: "light"`,
  `bodyBg: rgb(246,246,248)` mindkét mért képernyőn, és **a felületen nincs
  témaváltó**. A brief sötét módú kontrasztot kért; nem mérhető, mert sötét
  mód soha nem renderelődik. Vagy kövesse a rendszert és legyen kapcsoló, vagy
  a holt bekötést érdemes kivenni.
- ~~**(KÖZEPES) Az értesítési banner minden képernyőn ott ül** („NAV-beküldés
  folyamatban +8 további értesítés"), 375 px-en 40 px-et visz el a
  tartalomból, és a bezárása után is visszajön a következő navigációnál.~~
  **Visszavonva (2026-09-28, élő újraellenőrzés):** a „visszajön” rész nem
  áll. Bezárás után a banner app-on belüli navigációnál, ugyanabban a fülben
  végzett `goto`-nál és újratöltésnél is rejtve marad
  (`invohub.banner.dismissed` a `sessionStorage`-ban); csak **új fülben**
  jelenik meg újra, mert a `sessionStorage` fülönkénti — ez böngésző-
  szemantika, és a sweep minden képernyőt új lapon nyitott, így a mérés
  műterméke. A 40 px-es magasság mobilon tudatos döntés
  (`components/notifications/NotificationBanner.tsx` fejléc-kommentje);
  nem hiba.
- ~~**(ALACSONY, rendszerszintű) Beviteli mezők 42 px magasak mobilon**~~
  **VISSZAVONVA.** A söprés a DOM `<input>` elemet mérte, ami egy 44 px-es
  (`TAP_TARGET_H`), kerettel együtt tapintható burok *belseje* — 44 − 2 px
  keret = 42. Az érintőfelület a burok (`components/ui/input/index.tsx:45`),
  és az már a padlón van. Rossz elemet mértem; nem hiba.
- (ALACSONY) „Következő lépések" sorai 301×42; a PDF-beállítás „Be" felirat
  39×44.
- A „Továbbiak" lap: 14 elem, **egyik sem 44 px alatt** ✓.

---

## 3. Amit ebben a körben már megcsináltam

### 3.1 Vezérlőpult KPI-k (`slice/dashboard-true-kpis`, push-olva, PR még nincs)

„E havi bevétel" = az adott naptári hónapban **kifizetett** számlák
bruttója, a darabszám ugyanígy szűkítve, a segédszöveg megnevezi az alapot
(„kifizetés dátuma szerint"). „Becsült fizetendő ÁFA" = a negyedévben
**kiállított** bizonylatok ÁFÁ-ja — az az alap, amit a segédszöveg eddig is
állított, és amit a kötelezettség ténylegesen követ; piszkozat és díjbekérő
sosem számít, sztornózott eredeti igen (a sztornó viszi az ellentételt). A
„Bevétel statisztika" sáv mindkét oldala mindenkori alapú maradt (külön
`paidTotal`), hogy ne egy hónapot vessen össze minden idővel.

Böngészőben igazolva: **0 Ft · 0 számla · kifizetés dátuma szerint** és
**86 697 Ft** — pontosan az SQL-lel számolt értékek.

Megjegyzés a tulajdonosnak: az ÁFA-alap váltása (kifizetettről kiállítottra)
adózási szemantika. A szám most azt teszi, amit a felület szövege 2026-09-14
óta ígér, de érdemes egy könyvelővel megerősíttetni — a jelentés „Nem
adótanácsadás" szövege marad.

---

## 4. Amit ellenőriztem, és **nem** hiba

- **Az adóhatósági export dátummezője `01/01/2026`-ot mutat** a képen. A
  `DateField` weben natív `<input type="date">`
  (`components/ui/date-field/index.web.tsx:24-25`) — a formátum a **böngésző
  nyelvét** követi, a headless Chrome angol volt. Magyar Chrome-ban
  `2026. 01. 01.` Nem javítandó.
- **0 px vízszintes túlcsordulás** mind az 50 felvételen; **0 db 4xx/5xx**
  API-válasz; **0 konzolhiba** a nyugta-részletezőn kívül.
- Elsődleges gomb a hajtás felett **minden** képernyőn, mindkét nézetben.
- Betöltési idők (6–14 s) a **fejlesztői** Metro-szerver számai, nem
  termelési mérések — nem hivatkozom rájuk.

---

## 5. Milyen funkciók hiányoznak még egy EV-nek

Csökkenő fontossággal; ⚠️ = tulajdonosi/jogi jóváhagyás, nem mergelhető
automatikusan.

1. ⚠️ **Valódi NAV-jelentés**: teszt-környezeti körbejárás (`queryInvoiceData`
   + fixture-mátrix), majd az éles mód tudatos bekapcsolása saját
   hitelesítéssel — a Phase 1 kapuja (1.1).
2. **NAV-állapot a listán és a vezérlőpulton**, NAV-hiba szűrőchippel és
   „Következő lépések" sorral (1.2).
3. **Év/hónap szűrő + lapozás** a számlalistán, és a lista havi
   statisztikájának kijavítása (1.3, 1.4).
4. **Lista-export a könyvelőnek** (CSV/XLSX a szűrt listáról) — ma csak a
   23/2014 NGM XML van, ami ellenőrzésre való, nem havi könyvelésre.
5. **AAM kérdés az onboardingban** + adószám-validáció + NAV-lekérdezés már
   ott (2.5).
6. **Teljesítés dátuma a részletezőn** (2.3).
7. **NAV-lekérdezés a partner-űrlapon** + „Számlái" link (2.6).
8. **Sötét mód**: rendszerkövetés + kapcsoló, vagy a holt kód eltávolítása
   (2.7).
9. **Cron-hiba riasztás** — ma egy elszállt emlékeztető-futás senkinek nem
   szól (a szeptember 23-i #44 láthatóvá tette az eredményt, de nem
   értesít). Meglévő backlog-tétel.
10. ⚠️ **Önkiszolgáló adatexport és fiókzárás felülete** — a szerveroldal
    (#36) megvan, felület nincs; a jogi szövegek ígérik.
11. „Fizetettnek jelölés" a listából (ma csak a részletezőről), sztornó/
    díjbekérő/részleges chipek.
12. A **táblázatos import elrejtése** egy flag mögé: ma történelmi számlákat
    EUR-piszkozatként újra „kiállít" (`IMPORT-1`), és ezek okozzák a
    lista piros bannerét is.

---

## 6. Javasolt sorrend — kis, szállítható szeletek

| # | Szelet | Méret | Miért ez előbb |
|---|---|---|---|
| 1 | Lista havi statisztika: csak véglegesített, nem díjbekérő | S | egy WHERE-feltétel, ma 92-szeres a hiba |
| 2 | NAV-állapot a listasoron + kártyán + „Következő lépések" NAV-sor | M | a legnagyobb félrevezetés a napi képernyőn |
| 3 | Számlalista: év/hónap szűrő + „több betöltése" | M | 30 felett ma elzár |
| 4 | Onboarding: AAM kérdés + adószám-validáció | M | az első számla helyes ÁFA-kezelése |
| 5 | Teljesítés dátuma a részletező fejlécén és idővonalán | S | ellenőrzési adat, amit NAV kap, de a felület nem mutat |
| 6 | Beviteli mezők 44 px + „Kinyitás" + „Következő lépések" sorok | S | egy helyen, rendszerszintű |
| 7 | Üres állapot: a demó-gomb hivatkozás csak `ALLOW_DEV_SEED` mellett | S | egy nem létező gombhoz irányít |
| 8 | Sötét mód: rendszerkövetés + kapcsoló a Beállításokban | M | bekötve, elérhetetlen |
| 9 | Lista-export CSV/XLSX | S | könyvelő |
| 10 | Partner-űrlap NAV-lekérdezés + „Számlái" | M | kézi gépelés minden partnernél |
| 11 | Import flag mögé + ADR | S | teszt-adat-szennyezés forrása |
| 12 | ⚠️ NAV teszt-körbejárás (`queryInvoiceData`, fixture-mátrix) | L | Phase 1 kapu |
| 13 | ⚠️ Éles NAV mód bekapcsolása, saját hitelesítéssel | L | „replaces the accountant" előfeltétele |
| 14 | ⚠️ Adatexport + fiókzárás felület | M | jogi ígéret |

---

## 7. Elavult backlog-tételek — takarítandó

Fable átolvasása és az én ellenőrzésem szerint a `docs/loop-queue.md`
három tétele már nem áll:

- **„A finalized invoice can be deleted through the internal API"** —
  szerveroldalon javítva (`b0f6062`); ami maradt: a felület még kínál
  „Törlés"-t véglegesített sorokon és elnyeli a 409-et. A tétel újrafogalmazandó
  felületi hibává.
- **„Invoice PDFs cannot render ő and ű"** — kész (Noto Sans beágyazva); a
  `loop-queue.md:1322` bejegyzés elavult duplikátum.
- **HTML-előnézet paritás (`preview-html.ts`)** — a fájl nem létezik, a tétel
  tárgytalan.
