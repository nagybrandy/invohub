# InvoHub — bejelentkezett app UX/UI audit (2026-09-14)

**Scope:** a bejelentkezett alkalmazás (`/dashboard`, `/invoices`, `/invoices/new`,
`/invoices/[id]`, `/invoices/[id]/edit`, `/clients`, `/products`, `/receipts`,
`/settings/*`, `/import`, `/onboarding`). A marketing oldal és a `/login` nem része.

**Módszertan:** Expo web dev szerver a fő checkoutból (`npx expo start --web --port 8137`),
bejelentkezés a seedelt teszt fiókkal, `POST /api/dev/seed` demó adat (8 ügyfél,
10 termék, 12 számla, 8 nyugta, 4 bejövő, 2 NAV nyugta-beküldés), majd Playwright
képernyőképek **1440×900 (desktop)** és **375×812 (mobil)** méretben.
Képek: `docs/design/screens/2026-09-14/` — fájlnév minta
`<sorszám>-<képernyő>[-<görgetési képkocka>].<desktop-1440x900|mobile-375x812>.png`.
Hosszú képernyőkről több képkocka készült, mert a React Native Web belső
scroll-konténert használ (nincs valódi `fullPage`).

**Súlyosság:** `Kritikus` (adatvesztés / hibás bizonylat / használhatatlan képernyő) ·
`Magas` (fő munkafolyamatot akasztja) · `Közepes` (lassít, bizonytalanságot okoz) ·
`Alacsony` (kozmetikai).

**Perszóna:** Teszt Elek, egyéni vállalkozó. Havonta 5–15 számlát állít ki,
2–3 visszatérő partnernek, laptopról. Amit akar: gyorsan kiszámlázni, látni ki
tartozik, és nyugodtan aludni, hogy a NAV rendben van.

---

## 0. Összefoglaló

A bejelentkezett app **egy telefonra tervezett felület, amit 1440 pixelre húztunk szét**.
Nincs olyan képernyő (a `/invoices/new` kivételével), amely bármilyen desktop
elrendezést használna: nincs oldalsáv, nincs táblázat, nincs tartalmi max-szélesség,
nincs kétoszlopos űrlap. A `components/layout/ScreenLayout.tsx` egyetlen
`max-w-*` osztályt sem tartalmaz, a négy listaképernyő
(`invoices`, `clients`, `products`, `receipts`) egyike sem hivatkozik
`isDesktop`-ra, `useWindowDimensions`-re vagy `md:` breakpointra a padding
kivételével. Ez a tulajdonosi brief három panaszából kettőnek (**"nehéz látni, mi hol
van"**, **"nem szép"**) a közvetlen gyökéroka.

A harmadik panasz (**"a menü nem világos"**) ennél is súlyosabb: a desktop
fejlécben mindössze három menüpont van (Számlák / Áttekintés / Beállítások), és
a kódban **semmi nem hivatkozik** a `/clients`, `/products`, `/receipts`, `/import`
útvonalakra a bejelentkezett felületen. Ezek desktopon csak URL beírásával érhetők el.

A számlakészítés pedig **14 mezőt kér az első tétel előtt**, közben egy
**hazugságot ír ki** ("Automatikusan mentve piszkozatként 20:35-kor" — semmi nem
mentődik), és **rejtett e-mail kiküldést** kapcsol be a felhasználó tudta nélkül.

---

## 1. In-app navigáció

Fájlok: `components/navigation/AppShell.tsx`, `DesktopTopBar.tsx`,
`MobileAppHeader.tsx`, `lib/app-navigation.ts`.
Képek: minden desktop kép felső 80 px-e; `01-dashboard-1.mobile-375x812.png`.

### Mit akar a felhasználó
Egy kattintással eljutni oda, ahol a munkája van: számlák, partnerek, beállítások —
és bármikor új számlát kezdeni.

### Mi zavaros

| # | Megállapítás | Súlyosság |
|---|---|---|
| N1 | **Az Ügyfelek, Termékek, Nyugták és Import képernyők desktopon egyáltalán nem érhetők el navigációból.** A `DESKTOP_TOP_NAV` három elemet tartalmaz (Számlák, Áttekintés, Beállítások). A dashboard nem linkel rájuk, a Beállítások hub sem. `grep -rn "routes.clients\|routes.products\|routes.receipts\|routes.import" app components` a bejelentkezett UI-ban **csak `router.replace` mentés utáni visszairányítást** talál — egyetlen navigációs linket sem. 8 demó ügyfelünk és 10 termékünk van, amihez URL-t kell gépelni. | **Kritikus** |
| N2 | `lib/app-navigation.ts` **halott kódot** tart életben: `getDesktopNavItems()`, `getDashboardFeatures()`, `DASHBOARD_FEATURE_NAV` és `ADMIN_NAV` sehol nincs renderelve. Egy desktop oldalsáv terve tehát létezik, csak soha nem került be. Ez félrevezeti a következő fejlesztőt is. | Magas |
| N3 | A cégnév-gomb `ChevronDown` ikont visel, de **nem dropdown** — a Céges profilra navigál. A saját kódkommentje elismeri ezt ("isn't a switcher despite the chevron"). A chevron ígéretet tesz, amit a kattintás megszeg. | Közepes |
| N4 | Az avatar (`TE`) is csak a Beállításokra visz; a kijelentkezés két kattintásnyira, a Beállítások oldal **aljára** temetve. Nincs sehol felhasználói menü. | Közepes |
| N5 | **Az aktív állapot alig látszik.** Az aktív menüpont `font-semibold text-white` + egy 2 px-es fehér alávonás, az inaktív `font-normal text-[#f9f9f9]` — a két szövegszín gyakorlatilag azonos, csak a vastagság és a hajszálvonal különbözteti meg őket sötétkék alapon. | Közepes |
| N6 | A jobb felső sarokban **négy elem versenyez** ("+ Új számla" gomb, harang 9-es badge-dzsel, avatar, HU/EN kapcsoló). A HU/EN kapcsoló a legjobb oldali, legnagyobb kontrasztú (fehér-kék) elem — vizuálisan fontosabbnak tűnik, mint az "Új számla". Ráadásul a nyelv **még egyszer** megjelenik a Beállítások első kártyájaként. | Közepes |
| N7 | Az értesítési szalag (`NAV submission pending (+8 more)`) **angolul**, minden képernyőn ott ül, 48 px magasságot foglal, és nem zárható be — csak megnyitható. A HU nyelv aktív. Lásd I18N-2. | Magas |
| N8 | Nincs breadcrumb-konzisztencia: `/dashboard` és `/invoices/new` breadcrumb-ot mutat ("Főoldal / Áttekintés" — egy legfelső szintű oldalon redundáns), `/invoices`, `/invoices/[id]`, `/settings/*` viszont nem. Az almenükből (pl. `/settings/pdf`) **nincs vissza-link** a Beállításokhoz. | Közepes |
| N9 | A Beállítások aloldalain nincs másodlagos navigáció (nincs bal oldali settings-nav). Minden aloldal-váltás: vissza a `/settings` hubra, majd újra be. 5 aloldalnál ez érezhető. | Közepes |

### Mobil (375×812)
A tab bar **jó**: Számlák · Ügyfelek · **+** · Áttekintés · Beállítások, középen a
plusz. Az "Új számla" mobilon valóban egy koppintás. Két megjegyzés:
- a Termékek / Nyugták / Import mobilon sincs sehol (ugyanaz az N1 hiba);
- a fejléc avatarja a **cégnév** kezdőbetűit mutatja ("ID" = *I*nvoHub *D*emo), ami
  értelmetlen monogram; az `initials()` a `companyName`-re esik vissza.

### "Új számla" mindig egy kattintás?
- **Desktop: igen** — állandó gomb a fejlécben (`DesktopTopBar` → `onNewInvoice`).
- **Mobil: igen** — középső tab.
- De: az `/invoices` listán **még egy** "Új számla" gomb van a címsor mellett, más
  stílussal (kisebb, halványabb kék) — ugyanaz a művelet kétszer, két megjelenéssel.
  Az `/clients` ugyanezt "Hozzáadás"-nak, a `/receipts` "Új"-nak hívja. Három
  különböző címke ugyanarra a mintára.

---

## 2. Számla készítése — `/invoices/new`

Fájl: `app/(app)/invoices/new.tsx` (844 sor), `components/invoices/LineItemEditor.tsx`.
Képek: `05-invoice-new-a-empty-*`, `06-invoice-new-b-partner-selected-*`,
`07-invoice-new-c-line-item-filled-*`, `08-invoice-new-d-advanced-open-*`,
`09-invoice-new-e-preview-*`, `09b-invoice-new-f-validation-error-*`.

### Mit akar a felhasználó
"Kiszámlázom a Tech Solutionsnak a szeptemberi munkát, 450 000 Ft + áfa, 8 nap
határidő." Ez **három adat**. Most ehhez a képernyő 14 mezőt és egy három
képernyőnyi görgetést kér.

### Hány mező az első tételig?

| Kártya | Vezérlők |
|---|---|
| Bizonylattípus fül | 4 fül (Számla / Díjbekérő / Előlegszámla / **Nyugta**) |
| "Kinek szól a bizonylat?" | Partner neve vagy adószáma, Ország, Adószám, Irányítószám, Város, Cím, E-mail cím = **7** |
| "Dátumok és fizetés" | Teljesítés dátuma, Számla kelte, Folyamatos teljesítés (kapcsoló), Fizetési mód (4 chip), Pénznem (2 chip), [Árfolyam, ha EUR], Fizetési határidő (input + 3 chip), Bankszámlaszám = **7–8** |
| **Összesen az első tétel előtt** | **14–15 vezérlő, ~25 kattintható elem** |

Ezután tételenként még: Megnevezés, Menny., Egységár, **ÁFA kezelés (7 chip)**,
ÁFA kulcs (4 chip).

### Mi zavaros / rossz

| # | Megállapítás | Súlyosság |
|---|---|---|
| **INV-1** | **"Automatikusan mentve piszkozatként 20:35-kor" — ez nem igaz.** A `savedAt` state-et egy `useEffect` állítja be minden billentyűleütésre (`new.tsx:174`), de **semmilyen hálózati hívás nem történik**. A mentés kizárólag a `handleSave()`-ben, a lábléc gombjaival fut le. Aki elnavigál vagy frissít, mindent elveszít, miközben az app azt írta neki, hogy mentve van. | **Kritikus** |
| **INV-2** | **Rejtett, visszafordíthatatlan e-mail kiküldés.** Mentett partner kiválasztásakor a kód `setEmailOnSend(true)`-ot hív (`new.tsx:207`), ha a partnernek van e-mail címe. Ez a kapcsoló a **összecsukott** "További beállítások" szekcióban él. A "Számla elkészítése" gomb így **e-mailt küld a partnernek** anélkül, hogy a felhasználó valaha látta volna a kapcsolót vagy megerősítést kapott volna. Lásd `08-invoice-new-d-advanced-open-3.desktop-1440x900.png`: a "Bizonylat postázása e-mailben" kapcsoló bekapcsolt állapotban van, pedig a felhasználó csak egy partnert választott. | **Kritikus** |
| **INV-3** | **A validációs hiba ~1200 px-rel a hibás mező alatt jelenik meg**, apró piros szövegként az űrlap legalján (`09b-invoice-new-f-validation-error-3`). Nincs scroll-to-field, nincs mezőkiemelés, nincs fókuszálás. A felhasználó a lebegő láblécben lévő gombra kattint az oldal tetején — és szemre **semmi nem történik**. | **Magas** |
| **INV-4** | **Egyetlen mező sincs kötelezőként jelölve.** Se csillag, se "kötelező" felirat, se szekció-szintű összefoglaló. Csak a `/onboarding` használ `Cégnév *` jelölést — az app többi része nem. Valójában két dolog kötelező (partner neve + legalább egy tétel), a maradék 12 opcionális. Ez nem derül ki semmiből. | **Magas** |
| **INV-5** | **Nincs termék-választó a tételszerkesztőben.** 10 mentett termékünk van a `/products` alatt, de a "Megnevezés" szabad szöveges mező, és sehol nincs "Termék beszúrása". A termékkatalógus tehát írásvédett listaként létezik, amit a számlázás nem használ. | **Magas** |
| **INV-6** | **Nincs mennyiségi egység a számlatételen.** A tételnél `Menny.` és `Egységár` van, `Mértékegység` nincs — miközben a **nyugtán** (`/receipts/new`) van "Mértékegység" mező (`16-receipts-new-1`). Ugyanaz a domain, két különböző adatmodell a felületen. Számlán a mennyiségi egység feltüntetése az Áfa tv. 169. § szerinti kötelező adat — ezt a NAV/adó-tulajdonosnak kell megerősítenie, de UX-szinten mindenképp inkonzisztens. | **Magas** (jelölve tax/NAV felülvizsgálatra) |
| **INV-7** | **Mind a 7 ÁFA-kezelési mód mindig látszik, minden tételen**, két sorban szétterülve: Adóköteles · AAM · TAM · KBAET — Közösségen belüli mentes (új közlekedési eszköz) · AHK — Közösségen belüli mentes (jövedéki termék) · FAD · ATK. Egy magyar EV-nek a 99%-ban az első kettő kell. A hosszú KBAET/AHK feliratok uralják a tételkártyát. Ez legyen legördülő + "Speciális adózás" link. | **Magas** |
| **INV-8** | **A dátumok szabad szöveges mezők** `ÉÉÉÉ-HH-NN` placeholderrel, webes dátumválasztó nélkül. Nincs validáció (a demó adatban a fizetési határidő korábbi, mint a kiállítás dátuma — az app ezt szó nélkül megjeleníti, lásd `03-invoice-detail-1`: Kiállítás 2026. 09. 06., Határidő 2026. 08. 23.). | **Magas** |
| **INV-9** | **Az előnézet kicseréli az űrlapot**, nem mellette jelenik meg. 1440 px-en, egy 1280 px-re korlátozott űrlapnál bőven lenne hely élő előnézetre. Ráadásul előnézet módban a **lebegő lábléc eltűnik**, így a kilépéshez a lap aljára kell görgetni a "Vissza a szerkesztéshez" gombhoz. | **Magas** |
| **INV-10** | **Az előnézet angol és formázatlan.** "Document preview" (hardcode: `components/invoices/InvoiceDocumentPreview.tsx:263`), "DRAFT", "Status: draft", "Bill to:", "Description / Qty / Unit / VAT / Total", "Issue / Due", "Subtotal / VAT / Total" — a forrás `lib/invoices/preview-html.ts` és `lib/invoices/generate-pdf.ts` **angolul generálja a bizonylatot**. Ez az, amit a magyar partner megkap. Semmilyen márkaelem nincs rajta. | **Kritikus** |
| **INV-11** | **A PDF előnézet-panel üresen pörög** (`03-invoice-detail-1`, `09-invoice-new-e-preview-1`): egy fehér doboz a képernyő felén, örökké forgó spinnerrel. Két egyenrangú "HTML" és "PDF" fül — a felhasználót nem érdekli a HTML/PDF megkülönböztetés, őt a *számla* érdekli. | **Magas** |
| **INV-12** | **A megjegyzés-blokk kiszivárog a bizonylatra.** A `composeInvoiceNotes()` egy szövegfolyammá fűzi a fizetési módot, bankszámlát, teljesítést és a számlázási címet, és ezt a `notes` mezőbe teszi: *"Teljesítés: 2026-09-14 Fizetés: Átutalás Bankszámla: 11773322-… Számlázási cím: 1134 Budapest Váci út 1. HU …"* — egyetlen tördeletlen bekezdésként a bizonylat alján (`09-invoice-new-e-preview-1`). Strukturált számlamezők helyett szövegkása. | **Magas** |
| **INV-13** | **A lábléc összesítője hiányos**: "Nettó összesen" + "Bruttó összesen", **ÁFA sor nélkül**. Magyar számlázásban az áfa összege az, amit az EV ellenőriz. | Közepes |
| **INV-14** | **A "Nyugta" fül nem fül, hanem navigáció.** A `handleDocumentTypeChange` `router.replace(routes.newReceipt)`-et hív — a felhasználó egy másik képernyőn találja magát, a beírt adatai elvesznek, figyelmeztetés nélkül. | **Magas** |
| **INV-15** | **A "Számla elkészítése" `sent` (Kiküldve) státuszt ment** akkor is, ha semmilyen kiküldés nem történt (`handleSave(documentType === "proforma" ? "proforma" : "sent")`). A lista így "KIKÜLDVE"-t mutat olyan számlára, amit senki nem kapott meg. Három gomb ("Előnézet", "Piszkozat mentése", "Számla elkészítése") közül egyik sem mondja meg, mi történik a kattintás után. Nincs siker-visszajelzés sem: `router.replace(routes.invoices)` — a felhasználó a listán találja magát, toast nélkül. | **Magas** |
| INV-16 | **Kiegyensúlyozatlan kétoszlopos elrendezés.** A bal "Kinek szól" kártya jóval magasabb, mint a jobb "Dátumok és fizetés"; a jobb oldalon ~140 px üres fehér doboz marad (`07-invoice-new-c-line-item-filled-2`). A kártyák nem azonos magasságúak, és nincs `items-start`. | Közepes |
| INV-17 | Az "Ország" mező szabad szöveg, alapértéke "Magyarország" — nincs országválasztó, így az EU-s / EU-n kívüli áfakezelés (ami a KBAET/FAD chipeket vezérelné) semmilyen módon nem kapcsolódik hozzá. | Közepes |
| INV-18 | A mentett partnerek **maximum 8 chipként** jelennek meg (`clients.slice(0, 8)`), keresés nélkül. 20 partnernél a 9. partner elérhetetlen a chipek közül, a fenti mező pedig nem autocomplete, csak szabad szöveg. | **Magas** |
| INV-19 | Mobilon a lebegő lábléc (2 sor összesítő + 3 egymás alatti gomb) **~290 px-t foglal a 812-ből**, plusz a fejléc és a NAV szalag — így az űrlapból egyszerre ~250 px látszik (`05-invoice-new-a-empty-1.mobile-375x812.png`). | Közepes (mobil) |

---

## 3. Számlalista — `/invoices`

Képek: `02-invoices-list-1..3.desktop-1440x900.png`, `…mobile-375x812.png`.

### Mit akar a felhasználó
"Ki tartozik nekem, és mióta?" — és onnan egy kattintás: emlékeztető / fizetettnek jelölés / PDF.

| # | Megállapítás | Súlyosság |
|---|---|---|
| L1 | **Telefonos kártyalista 1400 px szélességben.** Számlánként ~150 px magasság, képernyőnként 5 sor, a vízszintes tér ~60%-a üres. Ugyanakkor a **dashboardon** ugyanezek a számlák rendes táblázatban vannak (Sorszám / Partner / Fizetési státusz / NAV / Kiküldve / Kelt / Bruttó összeg). Az app tehát **tudja**, hogyan néz ki jól — csak a tényleges listaképernyőn nem használja. | **Kritikus** |
| L2 | **Nincs fizetési határidő és nincs hátralék a listán.** Csak a "Kiállítva" dátum szerepel. A legfontosabb kérdésre ("mikorra kellett volna fizetni?") a lista nem válaszol. | **Magas** |
| L3 | **Kétféle státuszjelölés él párhuzamosan.** Listán: KIKÜLDVE tömör kék, LEJÁRT tömör piros, PISZKOZAT tömör sötétkék, **FIZETVE fehér, körvonalas** — tehát a legjobb hír a legkevésbé látható, és **nem zöld**, szemben a `docs/brand.md` szabályával ("green only for paid/success"). A dashboard tábláján ugyanez a FIZETVE zöld körvonalas. Két rendszer, egy app. | **Magas** |
| L4 | **Az egyetlen látható sor-művelet a piros kuka.** Nincs "PDF letöltés", "E-mail küldés", "Fizetettnek jelölés" a soron — pedig a dashboard táblázatában *van* letöltés és "…" menü. A romboló művelet a leghangsúlyosabb elem a soron. | **Magas** |
| L5 | **A szűrő-chipek olvashatatlanok.** 8 chip (`Összes`, `Piszkozat`, `Díjbekérő`, `Kiküldve`, `Fizetve`, `Részben fizetve`, `Fizetetlen`, `Lejárt`, `Törölve`), amiből a kiválasztott cornflower, a többi **sötét navy tömör** — a nem kiválasztottak néznek ki „aktívnak/nyomottnak". Nincs darabszám egyik szűrőn sem. | **Magas** |
| L6 | **Pénznem-keveredés összegzés nélkül.** A "Havi összeg" **€5,560.06**-ot ír egy magyar EV-nek, mert a demó számlák egy része EUR. A lista Ft-ot és €-t kever egymás alatt, átváltás vagy „ebből EUR" bontás nélkül. A dashboard "Bevétel statisztika 232,220 Ft" pedig valószínűleg **összeadja a különböző pénznemeket** — ez hibás számot mutathat. | **Kritikus** (adat-hitelesség; számoló logika ellenőrzést igényel) |
| L7 | A statisztikai kártyák címkéi túl szűkszavúak: "Összesen 12", "E havi 5", "Havi összeg" — miből? kiállított? fizetett? A "Lejárt tartozás ... 2 számla, legrégebbi: 0 napja" (dashboard) mondat pedig önellentmondó. | Közepes |
| L8 | Nincs rendezés-vezérlő és nincs jelezve a rendezés. A számok látszólag össze-vissza jönnek (008, 004, 005, 010, 006, 002, 012, 003) — valójában kiállítási dátum szerint csökkenő, de ez sehol nem jelenik meg. Nincs lapozás/„továbbiak" sem. | Közepes |
| L9 | A "Gyors előnézet" kék link-szöveg a kártya bal alsó sarkában — a többi képernyőn semmi nem néz ki így; nem derül ki, hogy modalt nyit-e vagy navigál. | Alacsony |

---

## 4. Számla részletei — `/invoices/[id]`

Képek: `03-invoice-detail-1..2` (desktop és mobil).

| # | Megállapítás | Súlyosság |
|---|---|---|
| D1 | **11 egyforma, körvonalas gomb** három sorba tördelve, az oldal legalján, a hajtás alatt: Szerkesztés · E-mail küldése · Törlés · Másolás · Sztornó · Helyesbítő számla · Fizetettnek jelölés · Revolut · Barion. **Nincs elsődleges művelet**, és a `Törlés` / `Sztornó` pontosan úgy néz ki, mint az `E-mail küldése`. Egy sztornó visszafordíthatatlan és NAV-jelentési következménye van. | **Kritikus** |
| D2 | **A fejléc semmit nem mond a pénzről.** Csak számlaszám, partnernév, apró státusz-badge jobbra fent. Nincs "Lejárt 15 napja", nincs "Hátralék 825,50 €", nincs fizetési előzmény. A fenti kártya három sora (Kiállítás dátuma / Fizetési határidő / Összesen) 1400 px széles, ~120 px magas — három adat egy hatalmas dobozban. | **Magas** |
| D3 | **Ellentmondó dátumok figyelmeztetés nélkül**: Kiállítás 2026. 09. 06., Fizetési határidő 2026. 08. 23., státusz "KIKÜLDVE" — egy lejárt határidejű számla, amit az app nem jelöl lejártnak. | **Magas** |
| D4 | Nincs breadcrumb és nincs "vissza a számlákhoz" link. A böngésző vissza gombja az egyetlen kiút. | Közepes |
| D5 | "Document preview" angolul, a PDF panel üresen pörög (lásd INV-10 / INV-11). | **Kritikus** |
| D6 | A "NAV Online Számla" blokk és a "Beküldés a NAV-nak" gomb a dokumentum-előnézet **alatt**, a műveletek **fölött** ül — a NAV-státusz a legfontosabb megfelelőségi információ, mégis a harmadik sávban van. | Közepes |
| D7 | A "Revolut" / "Barion" gombok magyarázat nélkül állnak a Sztornó mellett. Fizetési linket generálnak? Integrációt kapcsolnak? Nem derül ki. | Közepes |

---

## 5. Számla szerkesztése — `/invoices/[id]/edit`

Kép: `04-invoice-edit-1..2`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| E1 | **Teljesen más űrlap, mint a létrehozás.** Egyoszlopos, 1340 px széles mezőkkel; nincsenek szekció-fejlécek, nincs partner-chip, nincs Ország / Irányítószám / Város / Cím / E-mail mező, nincs Teljesítés dátuma, nincs Folyamatos teljesítés, nincs határidő-gyorsgomb, nincs bankszámla, nincs lebegő összesítő-lábléc. Ugyanaz az objektum, két gyökeresen eltérő szerkesztő. Amit az egyiken felvettél, a másikon nem tudod módosítani. | **Kritikus** |
| E2 | A bizonylattípus-fülek itt is megjelennek — a "Nyugta" fülre kattintva egy **meglévő számla szerkesztése közben** az új-nyugta képernyőre dob. | **Magas** |
| E3 | 1340 px széles egysoros input mezők (Partner neve, Adószám). Az olvasható vonalhossz kb. 640–720 px; ez a duplája. | **Magas** |
| E4 | Egy lejárt figyelmeztetés nélkül szerkeszthető a már kiküldött / NAV-hoz beküldött számla — nincs semmilyen "ez már kiküldött bizonylat" állapotjelzés a szerkesztőben. | **Magas** (NAV-tulajdonos megerősítését igényli) |

---

## 6. Áttekintés — `/dashboard`

Képek: `01-dashboard-1..2`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| A1 | **Az app legjobb komponense (a számlatáblázat) ezen a képernyőn van elrejtve** "Legutóbbi számlák" néven, miközben a valódi számlalista rosszabb. Fordítva kellene. | Magas |
| A2 | **A NAV M2M demó panel a dashboard fél képernyőjét elfoglalja** ("NAV adószámla (demó)", "DEMÓ ADAT" badge, 5 soros "API ellenőrzések / OK" lista, "Minden M2M végpont sikeresen válaszolt."). Ez fejlesztői diagnosztika, nem EV-tartalom. A "Detailed ledger lines" angolul van, az "Árvai Digital Kft." pedig kétszer szerepel egymás alatt. | **Magas** |
| A3 | **A "Becsült fizetendő ÁFA 49,370 Ft" alatt álló magyar mondat értelmetlen**: "ez az egyenlege az időszaknak". Egy adószámhoz kötött becslésnél a forrás/időszak/kalkuláció megjelölése elvárás. | **Magas** (adószám — tax-lektorálás szükséges) |
| A4 | A "Lejárt tartozás 171,450 Ft / 2 számla, legrégebbi: 0 napja" — a "0 napja" hibás vagy értelmetlen, és a kártya nem kattintható a lejárt számlák szűrőjére. Egyik statisztikai kártya sem vezet sehova. | Magas |
| A5 | A "Bevétel statisztika" kártya színkódolt jelmagyarázatot használ (zöld / kék / narancs pont), de **nincs diagram, amihez tartozna** — a színek semmit nem kódolnak, csak díszítenek. A narancs sehol máshol nem szerepel a designban. | Közepes |
| A6 | A "Bejövő számlák 2" és "Ügyfélszolgálat" gombok a lapcím jobb oldalán, ugyanolyan súllyal — két teljesen különböző dolog (adat vs. support) egy sorban, elsődleges művelet nélkül. | Közepes |
| A7 | Breadcrumb "Főoldal / Áttekintés" egy legfelső szintű oldalon. | Alacsony |

---

## 7. Ügyfelek — `/clients`, `/clients/new`, `/clients/[id]/edit`

Képek: `10-clients-list-1..2`, `11-clients-new`, `12-client-edit`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| C1 | **Terminológiai zűrzavar**: a lista "Ügyfelek", a számlaűrlap "Partner neve vagy adószáma" + "Mentett partnerek", a nyugta "Ügyfél neve", a validációs hiba "Az ügyfél neve kötelező", a lista alcíme pedig "Ügyfélnyilvántartás **könyvelői fiókokhoz**" — rossz perszóna, ez EV-termék. Válasszunk egy szót (javaslat: **Partnerek**) és tartsuk. | **Magas** |
| C2 | **A partner-adatmodell szűkebb, mint amit a számla kér.** A szerkesztő mezői: Név, E-mail cím, Adószám, Cím, Város. **Nincs irányítószám és nincs ország** — pedig a számlaűrlap mindkettőt kéri. Partner kiválasztásakor tehát az irányítószám mindig üres marad. | **Magas** |
| C3 | Nincs keresés, nincs rendezés, nincs oszlop — 8 partnernél már 2 képernyő, 40-nél használhatatlan. | Magas |
| C4 | A kártyák láthatóan nem interaktívak (nincs chevron, nincs hover-jelzés, nincs "Szerkesztés"), pedig kattinthatók. Nincs törlés sem, és nincs "Számla ennek a partnernek" gyorsgomb — pedig ez a leggyakoribb szándék egy partner listán. | **Magas** |
| C5 | A szerkesztő 1400 px széles mezőkkel, 1400 px széles "Változások mentése" gombbal. Nincs Mégse, nincs "vissza". | Magas |

---

## 8. Termékek — `/products`, `/products/[id]/edit`

Kép: `13-products-list-1..2`, `14-product-edit`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| P1 | **A termékkatalógus nem kapcsolódik semmihez** — a számlatétel-szerkesztőben nincs termékválasztó (INV-5). Így a képernyő gyakorlatilag funkciótlan. | **Magas** |
| P2 | Az árak a demóban **euróban** jelennek meg ("€45.00 · ÁFA 27%", "€1,200.00") egy magyar 27%-os áfakulcs mellett — nincs a terméken pénznem-fogalom, vagy rosszul öröklődik. | **Magas** |
| P3 | Nincs mennyiségi egység a terméken sem (ld. INV-6), nincs keresés, nincs törlés/szerkesztés-affordancia a kártyákon. | Közepes |
| P4 | A "Gyors hozzáadás" űrlap nem kér ÁFA-kulcsot, de a lista minden terméknél mutat egyet — honnan jön? | Közepes |

---

## 9. Nyugták — `/receipts`, `/receipts/new`, `/receipts/[id]`

Képek: `15-receipts-list-1..2`, `16-receipts-new-1..2`, `17-receipt-detail-1..2`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| R1 | **Az új nyugta űrlap félig angol.** Egyetlen kártyán belül: "Nyugtaszám", "Ügyfél neve", "Pénznem", "Fizetési mód" — majd **"Item 1"**, **"Net price"**, **"Qty"**, **"VAT rate"**. Forrás: `app/(app)/receipts/new.tsx:342, 367, 384, 414` — hardcode-olt angol sztringek, i18n kulcs nélkül. Ez sérti az AGENTS.md "hu+en i18n keys for every string" szabályát. | **Kritikus** |
| R2 | A nyugta-tétel mezősorrendje (**Net price → Qty → Mértékegység**) ellentétes a számla-tételével (**Menny. → Egységár**), és más a megnevezés is (Net price vs Egységár). | **Magas** |
| R3 | Az "Egyszerű / Részletes" kapcsoló a Tételek fejlécében magyarázat nélkül vált elrendezést. Nem derül ki, mi a különbség és melyik a biztonságos. | Közepes |
| R4 | A nyugta-részlet QR-kártyája **1400 × 290 px**, benne egy 200 px-es QR-kód középen — a képernyő harmada egyetlen kódnak. | Közepes |
| R5 | A tételsor "1 × 690 Ft (27% VAT)" → **876 Ft**: az angol "VAT" mellett nem derül ki, hogy a 690 nettó és a 876 bruttó. Nincs "nettó/bruttó" felirat. | **Magas** |
| R6 | A lista gombja "Új" (a számláké "Új számla", a partnereké "Hozzáadás"). | Közepes |

---

## 10. Beállítások — `/settings` és aloldalak

Képek: `20-settings-index-1..2`, `21-settings-company-1..2`, `22-settings-templates`,
`23-settings-pdf-1..2`, `24-settings-reminders`, `25-settings-api-keys`.

### `/settings` (hub) — az app **legjobb** képernyője
Rendes 2 oszlopos kártyarács, ikon + cím + leírás + chevron. Ez a minta kellene mindenhova.
De:

| # | Megállapítás | Súlyosság |
|---|---|---|
| S1 | **A "Demo adatok betöltése" a Beállítások legfeltűnőbb, teljes szélességű elsődleges gombja** — egy fejlesztői eszköz vizuálisan felülírja a Céges profilt. Éles fiókban ez véletlen adatszennyezéshez vezet. | **Magas** |
| S2 | A rács megtörik: 2 + 2 + **1 teljes szélességű** ("API kulcsok"), majd 2 + **1 teljes szélességű** ("Demo adatok"). Nincs következetes oszloprend. | Közepes |
| S3 | A "Sötét mód" **navigációs sor chevronnal**, pedig kapcsoló ("Jelenleg kikapcsolva") — más affordancia, mint amit csinál. Ugyanígy a "Nyelv" kártya beágyazott HU/EN kapcsolót tartalmaz, míg a többi kártya navigál. | Közepes |
| S4 | A "Kijelentkezés" az oldal legalján, körvonalas, a "Demo adatok" alatt. | Közepes |

### `/settings/reminders` — **teljesen lefordítatlan**

| # | Megállapítás | Súlyosság |
|---|---|---|
| **I18N-1** | A képernyő **nyers i18n kulcsokat renderel**: cím `reminders.title`, alcím `reminders.subtitle`, mezők `reminders.intervalDays`, `reminders.maxReminders`, gombok `reminders.saveSchedule`, `reminders.runNow`. Ellenőrizve: `lib/i18n/locales/hu.ts` és `en.ts` **nem tartalmaz `reminders.*` névteret** (csak a `settings.reminders` címkét). Mindkét nyelven törött. A képernyő így használhatatlan és bizalomromboló. | **Kritikus** |

### `/settings/templates` (E-mail sablonok)

| # | Megállapítás | Súlyosság |
|---|---|---|
| T1 | A sablontípusok **nyers angol azonosítóként** jelennek meg gomblistaként: "invoice notification", "payment reminder", "invoice reminder", "receipt notification", "proforma notification", "proforma reminder". | **Magas** |
| T2 | A törzs szerkesztője **nyers HTML textarea**: `<p>Dear {{clientName}},</p><p>Please find your invoice <strong>{{invoiceNumber}}</strong>…`. Egy EV-nek HTML-t kell írnia — és az alapértelmezett szöveg **angol**, magyar ügyfeleknek kiküldve. | **Kritikus** |
| T3 | A változólista egyetlen apró szürke sorban az alcímben ("Variables: {{invoiceNumber}}, …"), nincs beszúró gomb, nincs előnézet, nincs teszt-küldés. | Magas |
| T4 | Hat darab **1400 px széles** gomb egymás alatt típusválasztóként. Ezek fülek vagy lista kellene, hogy legyenek. | Közepes |

### `/settings/pdf` (PDF megjelenés)

| # | Megállapítás | Súlyosság |
|---|---|---|
| B1 | **A kiemelő szín alapértéke `#4f46e5` (indigo)** — nem a márka cornflower `#6495ed`-je. A `docs/brand.md` szerinti elsődleges akcentus sehol nem jelenik meg alapértelmezésként a kimenő bizonylaton. | **Magas** (brand) |
| B2 | Az alapértelmezett szövegek angolok: "INVOICE", "Notes", "Thank you for your business." — ezek a magyar számlán jelennek meg. | **Kritikus** |
| B3 | A három kapcsoló kék **"Be" feliratú gombként** renderelődik, nem `Switch`-ként — máshol az app valódi kapcsolókat használ (Céges profil "Alanyi adómentes", Számla "További beállítások"). Nem derül ki, hogy a "Be" az állapot vagy a művelet. | **Magas** |
| B4 | A "Betűméret" opciói **"Small / Medium / Large"** angolul. | Magas |
| B5 | 1440 px-en nincs élő PDF-előnézet a beállítások mellett — a "Minta PDF előnézete" külön gomb a lap alján. Ez a képernyő könyvjelzője lehetne a split-view mintának. | Közepes |

### `/settings/company` (Céges profil)
Az egyik legtisztább űrlap. Hibái: 1400 px-es mezőszélesség; nincs kötelezőség-jelölés;
a "Keresés" (adószám-lekérdezés) gomb a mező mellett magyarázat nélkül; nincs
sticky mentés-sáv egy ilyen hosszú űrlapon.
**Súlyosság: Közepes.**

### `/settings/api-keys`
Világos, de fejlesztőknek szól: a példakérés nyers JSON blokk 1400 px szélességben,
vízszintes túlcsordulás-kezelés nélkül; a „Példa kérés" a legfelső, legnagyobb blokk,
pedig a felhasználó kulcsot akar generálni. **Súlyosság: Alacsony.**

---

## 11. Import — `/import`

Kép: `30-import`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| IM1 | **Két fájlválasztó egymás alatt**: a böngésző natív, stílus nélküli `Choose File / No file chosen` (angol), alatta a márkázott "Fájl kiválasztása (web)" gomb. | **Magas** |
| IM2 | Az elvárt oszlopok **nyers snake_case angol azonosítóként** vannak felsorolva: `client_name, description, quantity, unit_price, vat_rate`. Nincs letölthető sablon, nincs példa, nincs előnézet/párosítás importálás előtt. | **Magas** |
| IM3 | Az oldal 90%-a üres a fájlválasztó alatt. Nincs korábbi importok listája, nincs visszavonás. | Közepes |

---

## 12. Onboarding — `/onboarding`

Kép: `31-onboarding`.

| # | Megállapítás | Súlyosság |
|---|---|---|
| O1 | **Az onboarding a teljes app-kerettel jelenik meg** — felső menü, NAV értesítési szalag, "+ Új számla" gomb. Egy első lépéses varázslóból ki lehet navigálni, mielőtt bármi elkészülne; és egy már beállított fiók is szabadon visszakerülhet ide (URL-lel), ahol újra "Cég adatai" fogadja. | **Magas** |
| O2 | A haladásjelző egy kétszínű csík, **lépésszám és lépésnevek nélkül** — nem tudni, hány lépés van hátra. | Közepes |
| O3 | Csak a "Cégnév *" van kötelezőnek jelölve; az **Adószám nincs**, pedig számlázni nélküle nem lehet. | **Magas** |
| O4 | A kártya `max-w` ~510 px, középre zárva — ez **az egyetlen képernyő az egész appban, aminek van tartalmi maximum szélessége**. Vagyis a helyes minta létezik, csak nincs alkalmazva máshol. | (megjegyzés) |

---

## 13. Vizuális minőség — `docs/brand.md` szerint

**Ami jó:** a színtokenek helyesek. `global.css`: `--primary: 100 149 237` (#6495ed
cornflower), `--secondary: 17 31 74` (#111f4a navy). A tokenrendszer megfelel a
brand dokumentumnak.

**Ami nem:**

| # | Megállapítás | Súlyosság |
|---|---|---|
| V1 | **Nincs tartalmi maximum szélesség.** `components/layout/ScreenLayout.tsx` egyetlen `max-w-*` osztályt sem tartalmaz. Három különböző szélesség él egymás mellett: a fejléc `max-w-[1440px]`, az `/invoices/new` `max-w-[1280px]`, minden más **korlátlan**. 1440 px-en a szövegsorok és a beviteli mezők 1340 px szélesek. Ez a "nem szép" panasz elsődleges oka. | **Kritikus** |
| V2 | **Nincs desktop elrendezés-réteg.** Egyetlen listaképernyő sem hivatkozik `isDesktop`-ra vagy `md:` rács-osztályra. A `ListScreen` egy `FlatList`, egyetlen oszloppal. Minden desktop képernyő = a telefonos képernyő nagyítva. | **Kritikus** |
| V3 | **A márka jegye sehol nem jelenik meg az appban.** A fejlécben egy generikus `FileText` lucide ikon áll a logó helyén — a `assets/brand/mark.svg` / `BrandMark` komponens a bejelentkezett felületen nincs használatban. A brand.md szerint "Footers and app chrome with room use the paired lockup". | **Magas** |
| V4 | **Hardcode-olt hexek a fejlécben** a tokenek helyett: `bg-[#1f305e]`, `#f9f9f9`, `#c5c7ca`, `bg-[#111f4a]` (`DesktopTopBar.tsx`). Sötét módban a felső sáv így nem követi a témát. | **Magas** |
| V5 | **A zöld szabály sérül.** A brand.md: zöld kizárólag fizetett/sikeres állapotra. A számlalistán a **FIZETVE fehér/körvonalas** (nem zöld), miközben a dashboardon zöld; a NAV demó panel "OK" sorai és a "Minden M2M végpont sikeresen válaszolt." **zöldek**, pedig ezek nem fizetési/sikeres-fizetés állapotok. A zöld tehát ott hiányzik, ahol kellene, és ott van, ahol nem. | **Magas** |
| V6 | **Ranade (címbetű) nem töltődik be az app dev szerveréről.** A `global.css` `@font-face` a `/marketing/assets/fonts/ranade-*.woff2` útvonalra mutat, ami csak a produkciós, rétegzett buildben létezik — a saját kódkomment is ezt írja. A képernyőképeken tehát a fallback látszik. Ellenőrizni kell éles környezetben; ha ott sem tölt be, a márka tipográfiája nincs jelen az appban. | **Magas** |
| V7 | **Egyetlen betűméret-skála az egész appban.** Minden oldalcím `Heading size="2xl"`, minden alcím `size="sm" text-muted-foreground`. Nincs tipográfiai hierarchia a szekciók, kártyák és adatok között — minden szám ugyanakkora, akár 12 db számláról, akár 171 450 Ft lejárt tartozásról van szó. | **Magas** |
| V8 | **Túl nehéz szegélyek, túl sok doboz.** `--border: 197 199 202` (#c5c7ca) fehér kártyákon #f6f6f8 háttéren: minden kártya keményen körberajzolt. Ehhez jön a `rounded-lg` + kártyaárnyék minden szinten, így a képernyők "dobozok dobozokban" hatást keltenek, csoportosítás nélkül. A brand.md 28 px-es marketing rádiusza sehol nem jelenik meg. | **Magas** |
| V9 | **Gomb-hierarchia hiánya.** Ugyanaz a művelet háromféle gombstílust kap (fejléc "Új számla" tömör kék + ikon; lista "Új számla" kisebb tömör kék; partner "Hozzáadás" apró tömör). A részletnézet 11 művelete viszont mind azonos körvonalas. Nincs kimondott elsődleges/másodlagos/romboló rendszer. | **Magas** |
| V10 | **Fejlesztői hibajelző a felhasználó képernyőjén.** Minden képernyőn ott ül egy piros LogBox buborék: *"React does not recognize the `%s` prop…"* és *"Received `true` for a non-boolean attribute `selectable`"*. Ez dev-only, de a `selectable` prop hiba valós és minden renderben fut. | Közepes |
| V11 | **Üres állapotok angolul.** `components/layout/ListScreen.tsx` alapértéke `emptyTitle = "Nothing here yet"` — hardcode. | Közepes |

---

## 14. Mobil (375×812) — nem romolhat

A mobil elrendezés **jelenleg működik**, és a tervezett desktop átalakítás nem
ronthatja el. Amit meg kell őrizni:

- az alsó tab bar (Számlák · Ügyfelek · **+** · Áttekintés · Beállítások) és benne a
  középső "Új számla";
- a kártyás listák 375 px-en jól olvashatók (`02-invoices-list-1.mobile-375x812.png`);
- a `KeyboardAvoidingView` az űrlapokon.

Mobil-specifikus meglévő hibák (a desktop munkával együtt érdemes javítani):

| # | Megállapítás | Súlyosság |
|---|---|---|
| M1 | Az `/invoices/new` lebegő lábléce (2 soros összesítő + 3 egymás alatti gomb) ~290 px-t foglal a 812-ből; a fejléccel és a NAV szalaggal együtt az űrlapból ~250 px marad. A gombok legyenek egy sorban, vagy a "Piszkozat mentése" kerüljön túlcsordulás-menübe. | Közepes |
| M2 | A Beállítások 2 oszlopos rácsa 375 px-en töri a hosszú címeket, és a chevron **rálóg a szövegre** ("Adóellenőrzési export", `20-settings-index-2.mobile-375x812.png`). Mobilon 1 oszlop kellene. | Közepes |
| M3 | A fejléc monogramja a cégnévből képződik ("ID" = InvoHub Demo) — értelmetlen. | Alacsony |
| M4 | A szűrő-chipek 3 sorba törnek a számlalistán, a lista előtt ~120 px-t elvéve. | Alacsony |

---

## Top 10 problems (rangsorolva)

A rangsor szempontja: mennyire akadályozza egy EV napi munkáját × mekkora a kár
(elveszett adat, hibás bizonylat, elvesztett bizalom).

1. **Az Ügyfelek / Termékek / Nyugták / Import képernyők desktopon nem érhetők el
   navigációból.** A desktop fejléc három linket tartalmaz, és az app kódjában
   *egyetlen* navigációs hivatkozás sincs ezekre az útvonalakra. Csak URL-beírással.
   *(N1, N2 — Kritikus; a brief „a menü nem világos" panaszának gyökere)*

2. **Az `/invoices/new` azt hazudja, hogy ment.** „Automatikusan mentve
   piszkozatként 20:35-kor" — miközben semmilyen mentés nem történik, és
   elnavigáláskor minden elvész. *(INV-1 — Kritikus)*

3. **A számla e-mailben kimegy a partnernek, anélkül, hogy a felhasználó kérte
   volna.** Mentett partner választása bekapcsolja a kiküldést, a kapcsoló egy
   összecsukott szekcióban van, megerősítés nincs. *(INV-2 — Kritikus)*

4. **A kimenő bizonylat (HTML és PDF) angol és márkázatlan.** „Bill to", „Status:
   sent", „Description / Qty / Unit / VAT / Total", alapértelmezett „INVOICE" cím,
   „Thank you for your business." lábléc, és indigo `#4f46e5` akcentus a márka
   cornflowerje helyett. Ez az, amit a magyar ügyfél megkap.
   *(INV-10, B1, B2 — Kritikus)*

5. **Nincs desktop elrendezés: minden képernyő a telefonos nézet 1440 px-re
   nyújtva.** Nincs tartalmi max-szélesség (`ScreenLayout`-ban egyetlen `max-w-*`
   sincs), nincs táblázat, nincs oldalsáv, 1340 px széles beviteli mezők.
   *(V1, V2, L1 — Kritikus; a brief „nehéz látni, mi hol van" + „nem szép" panaszának gyökere)*

6. **A számla létrehozása és szerkesztése két különböző űrlap.** A szerkesztőből
   hiányzik a cím, irányítószám, e-mail, teljesítés dátuma, határidő-gyorsgomb,
   bankszámla és az összesítő lábléc — amit létrehozáskor megadtál, azt nem tudod
   javítani. *(E1 — Kritikus)*

7. **A `/settings/reminders` nyers i18n kulcsokat mutat** (`reminders.title`,
   `reminders.saveSchedule`…), mert a `reminders.*` névtér egyik nyelvi fájlból sem
   létezik. Az `/receipts/new` félig angol („Item 1", „Net price", „Qty", „VAT rate"),
   az e-mail sablonok listája nyers angol azonosító, az értesítési szalag angol.
   *(I18N-1, R1, T1, N7 — Kritikus)*

8. **A számlalista nem válaszol a legfontosabb kérdésre: ki tartozik és mióta.**
   Nincs fizetési határidő oszlop, nincs hátralék, a „Fizetve" a legkevésbé látható
   státusz (fehér, nem zöld — brand-sértés), a szűrő-chipeknél a *nem kiválasztott*
   néz ki aktívnak, és az egyetlen sor-művelet a piros kuka. Közben a dashboard
   ugyanezt rendes táblázatban mutatja. *(L1–L5 — Kritikus/Magas)*

9. **14 mező az első számlatétel előtt, kötelezőség-jelölés nélkül, és a
   hibaüzenet 1200 px-rel a hibás mező alatt jelenik meg.** Ehhez jön a 7 ÁFA-kezelési
   chip minden tételen, a termékkatalógus-kapcsolat hiánya, a 8 partnerre korlátozott
   chiplista és a dátum-választó hiánya. *(INV-3…INV-8, INV-18 — Magas)*

10. **A számla részletnézet 11 egyforma gombja**, köztük a visszafordíthatatlan
    „Törlés" és „Sztornó", ugyanolyan súllyal, mint az „E-mail küldése" — a hajtás
    alatt, elsődleges művelet nélkül, miközben a fejléc semmit nem mond arról, hogy
    a számla lejárt-e vagy mennyi a hátralék. *(D1–D3 — Kritikus/Magas)*

---

### Kapcsolódó, nem UI-hatókörű jelzések (átadva, nem itt javítandó)

- **Pénznem-összeadás**: a dashboard „Bevétel statisztika" és a lista „Havi összeg"
  látszólag különböző pénznemű számlákat ad össze (`232,220 Ft` ill. `€5,560.06`).
  Ezt a számoló logikát ellenőrizni kell — tax/pénzügyi következménye van, ezért
  nem UI-javítás.
- **Mennyiségi egység hiánya a számlatételen** (INV-6) — az Áfa tv. 169. § szerinti
  kötelező adattartalom kérdése; NAV/adó-tulajdonos megerősítését igényli.
- **Kiküldött / NAV-hoz beküldött számla szabadon szerkeszthető** (E4) — NAV-viselkedés,
  nem ebben a munkafolyamatban módosítandó.
- **`selectable` prop hiba** minden renderben (V10) — valós React-figyelmeztetés.
