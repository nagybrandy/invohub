# NAV teszt beállítás — üzemeltetői lépések

Ez a dokumentum azt írja le, hogy az **üzemeltetőnek** (InvoHub tulajdonos) pontosan mit kell
egyszer, kézzel elvégeznie ahhoz, hogy a NAV Online Számla és NAV M2M integráció valódi
NAV teszt környezettel működjön. A **felhasználóknak** (EV-knek) semmit nem kell tenniük —
alapértelmezetten "Demó" módban indulnak, ami egy beépített szimulátort használ, NAV-fiók
nélkül.

## Áttekintés: három mód

| Mód | Kinek kell fiók? | Mit csinál |
|-----|-------------------|------------|
| **Demó** (alapértelmezett) | Senkinek | Beépített szimulátor, nem hív valódi NAV-ot |
| **NAV teszt** | Az üzemeltetőnek (közös fiók) VAGY az EV-nek saját fiókkal | Valódi `api-test.onlineszamla.nav.gov.hu` |
| **Éles** | — | Le van tiltva, amíg `NAV_PRODUCTION_ENABLED=true` nincs beállítva |

## 1. NAV Online Számla teszt technikai felhasználó létrehozása

1. Regisztrálj a **https://onlineszamla-test.nav.gov.hu** oldalon Ügyfélkapu+ (vagy DÁP)
   azonosítással. (Ez egy külön, teszt célú NAV fiók — nem az éles Ügyfélkapu.)
2. A regisztráció során add hozzá a céget (EV) az adószámával.
3. A felületen hozz létre egy **technikai felhasználót**:
   - Add meg egy technikai felhasználónevet és jelszót.
   - A rendszer generál egy **aláíró kulcsot (sign key)** — ezt másold ki.
   - Generálj egy **cserekulcsot (exchange/change key)** is — ez pontosan 16 karakter kell
     legyen (AES-128 kulcsként használjuk).
4. Jegyezd fel az öt értéket:
   - technikai felhasználónév
   - technikai jelszó
   - aláíró kulcs (sign key)
   - cserekulcs (exchange/change key, 16 karakter)
   - a cég adószámának első 8 számjegye (pl. `12345678`)

## 2. Szoftver-azonosító (softwareId) beszerzése

A NAV megköveteli, hogy minden hívó szoftver egy 18 karakteres, csak nagybetűket és
számjegyeket tartalmazó azonosítóval jelentkezzen be. Ezt te választod/generálod (nem kell
külön regisztrálni a NAV-nál v3.0 alatt) — legyen egyedi és stabil, pl.:

```
INVOHUB1234567890 (18 karakter, csak A-Z és 0-9)
```

## 3. Titkosítási kulcs generálása (NAV_CREDENTIALS_KEY)

A NAV technikai jelszavak, aláíró kulcsok és cserekulcsok titkosítva kerülnek tárolásra
(AES-256-GCM). Ehhez szükséges egy 32 bájtos kulcs:

```bash
openssl rand -base64 32
```

Ez nélkül **nem lehet** teszt/éles NAV hitelesítő adatot elmenteni (a mentés hibaüzenettel
elutasításra kerül) — demó módhoz erre nincs szükség.

## 4. Környezeti változók beállítása (Vercel / `.env`)

Másold be az `.env.example` NAV szekcióját, és töltsd ki:

```bash
NAV_SOFTWARE_ID=INVOHUB1234567890
NAV_CREDENTIALS_KEY=<az openssl rand -base64 32 kimenete>

# Közös InvoHub NAV teszt fiók (opcionális, de ajánlott — így a felhasználóknak
# nem kell saját NAV technikai felhasználót regisztrálniuk a teszteléshez)
NAV_TEST_LOGIN=<technikai felhasználónév>
NAV_TEST_PASSWORD=<technikai jelszó>
NAV_TEST_SIGN_KEY=<aláíró kulcs>
NAV_TEST_CHANGE_KEY=<cserekulcs, 16 karakter>
NAV_TEST_TAX_NUMBER=<cég adószáma>

# Éles jelentés kikapcsolva marad, amíg ezt kifejezetten be nem kapcsolod:
NAV_PRODUCTION_ENABLED=false
```

Vercelen: Project → Settings → Environment Variables, mindet Production + Preview
környezetre is állítsd be.

## 5. Ellenőrzés

Helyi gépen (`.env` fájllal) vagy a Vercel dev shell-ben:

```bash
npm run nav:check
```

Ez lefuttat egy valódi `tokenExchange` + `queryTaxpayer` hívást a NAV teszt szerver felé, és
magyar nyelvű OK/hiba üzenetet ír ki — **soha nem írja ki a titkos értékeket**. Siker esetén a
felhasználók a Beállítások > Cégadatok NAV szekcióban választhatják a "NAV teszt (közös
fiók)" opciót fiók nélkül.

## 6. NAV M2M (Adózó API) teszt regisztráció

Ismertebb, de kevésbé dokumentált folyamat — az alábbi lépések a nyilvánosan elérhető
információk alapján készültek, **néhány részlet ellenőrzésre szorul** a tényleges
m2m-dev.nav.gov.hu felületen:

1. Regisztrálj a **https://m2m-dev.nav.gov.hu** fejlesztői portálon.
2. Hozz létre egy alkalmazást / klienst — kapsz egy `client_id` + `client_secret` párost.
3. Regisztrálj egy M2M felhasználót (`username` + `password`).
4. Generálj egy aláíró kulcs első felét (`signature_key_first`) és egy `nonce` értéket a
   felületen (⚠️ *bizonytalan lépés — ellenőrizd a fejlesztői portál aktuális UI-ját, ez
   régiók/verziók között változhatott*).
5. Töltsd ki a `.env`-ben:

```bash
M2M_ENV=test
M2M_CLIENT_ID=
M2M_CLIENT_SECRET=
M2M_USERNAME=
M2M_PASSWORD=
M2M_SIGNATURE_KEY_FIRST=
M2M_NONCE=
```

6. Ellenőrzés:

```bash
npm run m2m:check
```

Ha az M2M_* változók nincsenek beállítva, az alkalmazás automatikusan a beépített M2M
demó szimulátorra vált (semmilyen hiba nem jelenik meg a felhasználóknak) — az irányítópult
"NAV adószámla (demó)" kártyaként mutatja ezt.

## 7. NAV eNyugta (nyugta-adatszolgáltatás)

A `lib/nav-receipt/` modul a NAV publikált eRECEIPT gépi interfészét hívja
(`nav-gov-hu/eRECEIPT`, XSD `xsd/1.1/receipt_datareport/receipt-if-schema-v1.1.1.xsd`) —
lásd `docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md`.

**Nincs külön `NAV_RECEIPT_*` környezeti változó** — az eNyugta ugyanazokat a céghez
tárolt NAV technikai hitelesítő adatokat használja, mint az Online Számla (Beállítások >
Cégadatok: technikai felhasználó, technikai jelszó, aláíró kulcs, adószám), és
ugyanazt a `company.navEnvironment` módváltót (demó / NAV teszt / éles).

| Mód | Végpont |
|-----|---------|
| **Demó** (alapértelmezett) | Nincs hálózati hívás — helyi szimuláció. |
| **NAV teszt** | `https://bv-receipt-if.enyugta.nav.gov.hu/v1` |
| **Éles** | **Nincs elérhető végpont.** `getReceiptBaseUrl("production")` mindig
  dobást (throw) ad — az InvoHubnak nincs ellenőrzött éles eNyugta hosztja, és a kód
  soha nem hívhat kitalált éles URL-t (lásd CLAUDE.md "NAV modes"). |

A `company.navReceiptSoftwareId` oszlop (a schema-ban ez a neve, de a beküldött
`CreateReceiptRequest`-ben mezőneve `issuingSoftware/name`) a regisztrált **szoftvernevet**
tárolja, nem egy azonosítót. A `POST /issuing-software/create` hívás (a szoftver
regisztrálása a NAV-nál) **egyszeri, kézi üzemeltetői lépés** ebben a szeletben — nincs
implementálva UI-ban vagy scriptben; a névnek egyszerűen egyeznie kell azzal, amit az
üzemeltető a NAV eNyugta portálján regisztrált. Amíg ez nincs beállítva, a kód `"InvoHub"`
alapértelmezett nevet küld.

⚠️ A NAV VAT-kategória *nevek* (`lib/nav-receipt/vat-category.ts`,
`NAV_VAT_CATEGORIES`) **nincsenek** a publikus XSD-ben rögzítve (csak minta-reguláris
kifejezés) — a hiteles lista a spec 5.9. szakaszában és a `GET /vat-category/list`
végponton érhető el, egyik sem volt elérhető a tervezés során. Emberi jóváhagyás
szükséges a beküldés előtt (lásd a terv 8. szakaszát, OQ-1).

## Nyitott kérdések / ellenőrizendő pontok

- Az `M2M_SIGNATURE_KEY_FIRST` / `M2M_NONCE` beszerzésének pontos UI-lépései a
  m2m-dev.nav.gov.hu felületen nincsenek nyilvánosan dokumentálva — a fenti 4. lépés
  ellenőrzésre szorul.
- A NAV Online Számla v3.0 `manageInvoice` kérés generálása és aláírása a
  [nav-gov-hu/Online-Invoice](https://github.com/nav-gov-hu/Online-Invoice) publikus minták
  alapján készült, és valódi `tokenExchange` hívással sikeresen validálva lett a NAV teszt
  szerverrel szemben (a NAV szabályos `INVALID_SECURITY_USER` hibát adott vissza teszt
  hitelesítő adatokkal — vagyis a kérés formátuma helyes, csak a hitelesítés hiányzott).
  A `manageInvoice`/`queryTransactionStatus` teljes kör (valódi számla beküldés) még nem lett
  élesben tesztelve valódi teszt fiókkal.
- Az `electronicInvoiceHash` mező (látható néhány valódi `manageInvoice` mintában) nincs
  implementálva — nem világos, mindig kötelező-e; XSD ellenőrzés ajánlott.
- A NAV eNyugta (elektronikus nyugta) modul (`lib/nav-receipt/`) protokollja a publikált
  `receipt-if-schema-v1.1.1.xsd` ellen ellenőrizve lett 2026-09-18-én (lásd
  `docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md` §1.2); demó módban (alapértelmezett)
  nem hív valódi végpontot, teszt módban a valódi `bv-receipt-if.enyugta.nav.gov.hu`
  hosztot hívja. A VAT-kategória nevek (OQ-1) és több más nyitott kérdés (§8 a tervben)
  emberi jóváhagyásra vár — még nem lett élesben, valódi teszt fiókkal beküldve.
- A `paymentMethod` (fizetési mód) és `paymentDate` (fizetési határidő) mezők mostantól
  bekerülnek a `manageInvoice` XML-be (`lib/nav/invoice-fields.ts`,
  `lib/nav/invoice-xml.ts`) — az elempozíció (`<paymentMethod>` az `<exchangeRate>` és a
  `<paymentDate>` között) és az öt elemű `base:PaymentMethodType` enum a publikus
  `invoiceData.xsd`/`invoiceBase.xsd` ellen ellenőrizve lett (lásd
  `docs/plans/2026-09-15-nav-xml-payment-method-date.md`). Az OSA 3.0 sémának **nincs**
  eleme a tényleges fizetés dátumára (`invoice.paidAt`) — a `paymentDate` a fizetési
  határidő (`dueDate`), nem a tényleges fizetés napja; a `paidAt` szándékosan nem kerül
  az XML-be.
