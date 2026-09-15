# InvoHub — bejelentkezett app UX/UI terv (2026-09-14)

**Bemenet:** `docs/design/app-ux-audit-2026-09-14.md` + `docs/design/screens/2026-09-14/` (117 kép).
**Hatókör:** a bejelentkezett app (`app/(app)/**`) UI/UX-e, plusz a képernyők
hooks/API glue-ja. **Nem** érintjük: `db/schema.ts`, `lib/nav/` produkciós
viselkedés, `lib/m2m/`, `lib/tax/` számok, marketing oldal, `/login`.
**Célgép:** desktop 1440×900 elsődleges, mobil 375×812 nem romolhat.
**Nyelv:** minden új sztring `hu` + `en` kulccsal (`lib/i18n/locales/`).

Ez a dokumentum **építési terv**, nem hangulatlap. Minden szakasz konkrét
komponensnevet, fájlútvonalat, méretet, tokent és i18n kulcsot ad meg.
A záró fejezet 4 párhuzamosan futtatható Sonnet trackre bontja a munkát.

---

## 0. Tervezési alapelvek (a brief három panaszára)

| Panasz | Gyökérok (audit) | Terv |
|---|---|---|
| „a menü nem világos" | 3 elemű felső nav, 4 képernyő nav nélkül (N1, N2) | Állandó desktop oldalsáv 6 elsődleges szekcióval + állandó „Új számla" |
| „nehéz látni, mi hol van" | nincs max-szélesség, nincs táblázat, nincs oldalcím-minta (V1, V2, L1, D4) | `PageHeader` (breadcrumb + cím + elsődleges művelet) minden képernyőn, `DataTable` desktopon, tartalmi max-szélesség |
| „a számlakészítés bonyolult" | 14 mező az első tétel előtt, hazug autosave, rejtett e-mail (INV-1…INV-19) | 3 lépéses composer, 1 kötelező mező a Partner lépésben, okos alapértékek, sticky összesítő + élő előnézet |
| „nem szép" | egy betűméret, nehéz szegélyek, gomb-hierarchia hiánya (V7–V9) | tipográfiai skála (Ranade címek), halkabb szegélyek, 3 szintű gomb-hierarchia, egységes státuszszínek |

**Két szabály mindenre:**

1. **Zöld kizárólag `paid` / sikeres fizetés.** Semmi más (NAV OK, M2M OK,
   dashboard legenda) nem lehet zöld. (`docs/brand.md`, V5)
2. **Romboló művelet soha nem néz ki úgy, mint egy semleges művelet.** Törlés
   és Sztornó külön, jelölt helyen (menü vagy „veszélyzóna"), soha nem
   ugyanabban a sorban az „E-mail küldése"-vel. (D1)

---

## 1. Információs architektúra és navigáció

### 1.1 Desktop shell (≥ 1024 px)

```
┌───────────────┬─────────────────────────────────────────────────────────┐
│ SIDEBAR 248px │ TOPSTRIP 56px  breadcrumb ············ 🔔  HU/EN  avatar │
│  (navy)       ├─────────────────────────────────────────────────────────┤
│  BrandLogo    │  PAGE CONTENT — max-w-[1200px] mx-auto px-8 py-6        │
│               │  ┌─ PageHeader: cím · alcím · [elsődleges művelet] ──┐  │
│ [+ Új számla] │  └───────────────────────────────────────────────────┘  │
│               │  Section / DataTable / Card grid …                      │
│  Vezérlőpult  │                                                         │
│  Számlák      │                                                         │
│  Nyugták      │                                                         │
│  Partnerek    │                                                         │
│  Termékek     │                                                         │
│  ─────────    │                                                         │
│  Importálás   │                                                         │
│  Beállítások  │                                                         │
│  [Admin]      │                                                         │
│               │                                                         │
│  ─────────    │                                                         │
│  Cégnév       │                                                         │
│  Kijelentkezés│                                                         │
└───────────────┴─────────────────────────────────────────────────────────┘
```

**Sidebar (`components/navigation/AppSidebar.tsx`, új)**

- Szélesség 248 px kinyitva, 72 px összecsukva (ikon-only, tooltip a címkével).
  Az állapot `localStorage` kulcs: `invohub.sidebar.collapsed`. 1024–1279 px
  között az alapértelmezés összecsukott, ≥ 1280 px felett kinyitott.
- Felület: `bg-secondary` (#111f4a token, **nem** hardcode hex — V4).
- Tetején `BrandLogo` (`components/marketing/BrandMark` lockup, `size="sm"`,
  `tone="onDark"`) — a generikus `FileText` lucide ikon eltűnik (V3).
- Alatta **elsődleges művelet: „+ Új számla"**, teljes szélességű `bg-primary`
  gomb. Ez az egyetlen tömör gomb a sidebarban, minden más nav-sor.
- Nav-sorok (`SidebarNavItem`): ikon 20 px + címke `text-sm`, 40 px magas,
  `rounded-lg`, 8 px vízszintes belső margó a sáv szélétől.
  - inaktív: `text-secondary-foreground/75`, ikon `iconColors.*.muted`-on-dark
  - hover: `bg-white/8`
  - **aktív: `bg-white/14` + 3 px bal oldali cornflower jelölősáv + `font-semibold text-white`** — nem hajszálvonal aláhúzás (N5)
- Szekciók sorrendje (EV napi munka szerint):

  | # | Címke (hu) | i18n kulcs | route | ikon |
  |---|---|---|---|---|
  | 1 | Vezérlőpult | `nav.dashboard` | `/dashboard` | `LayoutDashboard` |
  | 2 | Számlák | `nav.invoices` | `/invoices` | `FileText` |
  | 3 | Nyugták | `nav.receipts` | `/receipts` | `Receipt` |
  | 4 | Partnerek | `nav.partners` | `/clients` | `Users` |
  | 5 | Termékek | `nav.products` | `/products` | `Package` |
  | — | *divider* | | | |
  | 6 | Importálás | `nav.import` | `/import` | `Upload` |
  | 7 | Beállítások | `nav.settings` | `/settings` | `Settings` |
  | 8 | Admin panel *(csak admin)* | `nav.admin` | `/admin` | `Shield` |

  > **`nav.dashboard` új értéke: „Vezérlőpult"** (ma „Áttekintés"). A brief ezt
  > a szót kéri. Az `en` marad `Dashboard`.
  >
  > **`nav.clients` helyett `nav.partners` = „Partnerek"** minden bejelentkezett
  > felületen (C1 terminológiai zűrzavar). A route `/clients` marad; csak a
  > címke változik. `nav.clients` kulcs megmarad (nem törlünk kulcsot), de a
  > shellben, listákban és a composerben mindenhol `nav.partners`-t használunk.

- Sidebar lábléc: cégnév + adószám sor (`onPress` → `/settings/company`,
  **chevron nélkül**, mert nem dropdown — N3), alatta `Kijelentkezés`
  (`nav.signOut`) ikonos sor. A `signOut` így egy kattintás (N4).

**Topstrip (`components/navigation/AppTopStrip.tsx`, új)**

- 56 px magas, `bg-card`, alul 1 px `border-border/60`.
- Bal: `Breadcrumb` (a képernyő adja `PageHeader`-en keresztül; lásd 1.3).
- Jobb: értesítés-harang (badge), `LanguageSwitcher tone="onLight"`, avatar.
  Az avatar **a felhasználó nevéből** képez monogramot, nem a cégnévből (M3):
  `initials(userName ?? companyName)`.
- Az avatar egy valódi menüt nyit (`UserMenu` popover): Fiókbeállítások ·
  Céges profil · Kijelentkezés. (N4)
- A HU/EN kapcsoló innen **nem** vezet félre: `tone="onLight"`, ghost stílus,
  nem a képernyő legerősebb kontrasztú eleme (N6).

**Értesítési szalag (N7)**

- A `NotificationBanner` a topstrip alatt marad, de: (a) magassága 40 px,
  (b) **bezárható** (`X`, elrejtés a munkamenetre `sessionStorage`
  `invohub.banner.dismissed`), (c) a szövege i18n kulcsból jön — nincs
  hardcode angol. Kulcsok: `notifications.banner.navPending`,
  `notifications.banner.more` (`{{count}}`), `notifications.banner.dismiss`.

### 1.2 Mobil shell (< 1024 px) — nem romolhat

- **Marad** az alsó tab bar és a középső „+". Két változás:
  - `Ügyfelek` → `Partnerek` (címke, `nav.partners`).
  - Az 5. tab `Beállítások` helyett **`Továbbiak`** (`nav.more`), ami egy
    alsó lapot (`MoreSheet`) nyit: Nyugták · Termékek · Importálás ·
    Beállítások · Admin (ha admin) · Kijelentkezés. Ezzel a Termékek/Nyugták/
    Import mobilon is elérhető (N1 mobil fele), és a Beállítások egy koppintás
    marad a lapon belül.
- A középső „+" tab vizuálisan FAB: 52 px átmérőjű `bg-primary` kör, a tab bar
  fölé emelve 10 px-rel (`-mt-5`), fehér `Plus` ikon, címke nélkül.
  `accessibilityLabel` = `nav.newInvoice`.
- `MobileAppHeader` marad, de a monogram a felhasználóé (M3), és a jobb
  oldalon harang + nyelvkapcsoló marad.
- Breakpoint: a shell váltópontja **1024 px** (ma 768). 768–1023 px (tablet)
  így a mobil tab bart kapja, ami hüvelykujjal használható, és nem egy
  félig kész sidebart. A **tartalmi** `md:` osztályok (768 px) maradnak.

### 1.3 Oldalfejlécek — minden képernyőn ugyanaz

`components/layout/PageHeader.tsx` bővül (visszafelé kompatibilisen):

```tsx
<PageHeader
  breadcrumb={[{ label: t("nav.invoices"), href: routes.invoices },
               { label: invoice.invoiceNumber }]}
  title={invoice.invoiceNumber}
  subtitle={invoice.clientName}
  meta={<InvoiceStatusChip status={invoice.status} />}   // cím mellé, inline
  primaryAction={<Button …>…</Button>}                    // max 1
  secondaryActions={[…]}                                  // max 2 + „Továbbiak"
/>
```

Szabályok:

- **Breadcrumb csak akkor**, ha a képernyő nem legfelső szintű. `/dashboard`,
  `/invoices`, `/clients`, `/products`, `/receipts`, `/settings` → nincs
  breadcrumb (A7, N8). `/invoices/[id]`, `/invoices/new`, `/settings/*`,
  `/clients/[id]/edit` → van, és az első elem visszavezet a szülőre (D4, N9).
- **Pontosan egy elsődleges (tömör) gomb** képernyőnként. A listák „Új számla /
  Hozzáadás / Új" címkéi egységesen: `nav.newInvoice`, `partners.add`,
  `products.add`, `receipts.add` — mindegyik „Új …" formában (V9, R6).
- A `/settings/*` aloldalak kapnak bal oldali másodlagos navigációt
  (`SettingsNav`, 200 px, desktopon a tartalom mellett; mobilon a
  breadcrumb elég) — N9.

### 1.4 Halott kód

`lib/app-navigation.ts`: `getDesktopNavItems()` most **valóban** renderelődik
(sidebar), `DESKTOP_TOP_NAV` törlendő (a topstrip nem hordoz navot),
`DASHBOARD_FEATURE_NAV` megmarad a dashboard „gyors ugrás" kártyáihoz.
`getDashboardFeatures()` vagy használatba kerül, vagy törlendő — ne maradjon
renderelés nélküli export (N2).

---

## 2. Számla készítése — újratervezés

### 2.1 A cél

„Kiszámlázom a Tech Solutionsnak a szeptemberi munkát, 450 000 Ft + áfa,
8 nap határidő." → **partner kiválasztása + 1 tételsor + Véglegesítés.**
Minden más legyen alapértelmezett és elrejtve.

### 2.2 Struktúra: 3 lépés, desktopon 2 oszlopban

Új komponens-család: `components/invoices/composer/`

```
components/invoices/composer/
  InvoiceComposer.tsx        ← a teljes flow; new.tsx és edit.tsx ezt rendereli
  ComposerStepper.tsx        ← 1 Partner · 2 Tételek · 3 Ellenőrzés (kattintható)
  StepPartner.tsx
  StepLineItems.tsx
  StepReview.tsx
  ComposerSummary.tsx        ← sticky összesítő (nettó / ÁFA / bruttó) + előnézet
  PartnerPicker.tsx          ← autocomplete az összes partnerre
  LineItemRow.tsx            ← egy tételsor (desktop rács / mobil kártya)
  VatCategoryPicker.tsx      ← 2 gyakori + „Speciális adózás" expander
  useInvoiceComposer.ts      ← state, defaultok, validáció, mentés
```

**Desktop (≥ 1024 px)**

```
PageHeader: Főoldal / Számlák / Új számla   [Piszkozat mentése] [Véglegesítés ▾]
ComposerStepper  ①Partner ──── ②Tételek ──── ③Ellenőrzés & küldés
┌──────────────────────────────────── 1fr ──────────────┬──── 400px ────┐
│  aktív lépés tartalma (max-w-[720px] a mezőkre)       │ ComposerSummary│
│                                                        │  sticky top-24 │
│                                                        │  Nettó  … Ft   │
│                                                        │  ÁFA    … Ft   │
│                                                        │  Bruttó … Ft   │
│                                                        │  ──────────    │
│                                                        │  [Előnézet]    │
│                                                        │  élő doksi     │
└────────────────────────────────────────────────────────┴───────────────┘
```

- A jobb oszlop **mindig látszik** — az előnézet nem cseréli le az űrlapot
  (INV-9). A `ComposerSummary` alján egy kicsinyített, élő
  `InvoiceDocumentPreview` (scale ~0.55, `pointer-events-none`), fölötte
  „Teljes előnézet" gomb, ami modalban nyitja nagyban.
- A lépések **kattinthatók** oda-vissza; nincs kényszerített varázsló.
  A 2. és 3. lépés csak akkor „kész" jelölésű, ha a saját minimuma teljesül.
- Mezőoszlop max 720 px — soha nem 1340 px széles input (E3, V1).

**Mobil (< 1024 px)**

- Egyszerre egy lépés, a stepper felül kompakt („2/3 · Tételek").
- Az összesítő egy **48 px magas** sticky sáv a lábléc fölött:
  `Bruttó 571 500 Ft ▴` — koppintásra felcsúszik a nettó/ÁFA bontással.
  A lábléc **egy sor**: `[Vissza] [Tovább]`, a 3. lépésen
  `[Vissza] [Véglegesítés]`, a „Piszkozat mentése" a fejléc `⋯` menüjében.
  Így a lábléc 290 px helyett ~112 px (M1, INV-19).

### 2.3 Lépés 1 — Partner

**Kötelező: 1 mező.** A partner neve. Minden más opcionális és összecsukott.

- `PartnerPicker`: egyetlen keresőmező, **autocomplete az összes partnerre**
  (`useClients()`, kliens oldali szűrés név/adószám szerint, max 8 találat
  listában, billentyűzettel navigálható). A 8 chipes korlát megszűnik (INV-18).
  - Üres állapotban a 4 **legutóbb számlázott** partner chipként (gyors út).
  - „+ Új partner" a találati lista alján → inline felvitel (név + e-mail +
    adószám), nem navigál el az űrlapról.
- Partner kiválasztása után egy **összegző kártya** jelenik meg
  (név, adószám, cím, e-mail) + „Adatok szerkesztése" link, ami kinyitja a
  mezőket. A 7 mező alapból **nem látszik** (INV a „14 mező" gyökere).
- Hiányzó irányítószám/ország: a partner-modell nem tartalmazza (C2). A
  composer ezeket üresen hagyja, és a mezők mellett halvány
  „a partnernél nincs megadva" hint áll; a `lists` track a partner-űrlapot
  kiegészíti (`zip`, `country`) — **API/DB oldalon a `lists` track NE nyúljon
  `db/schema.ts`-hez**; ha a mező nem létezik az API-n, a UI csak a
  számlán tárolja, és a partner-űrlag bővítése külön queue-item lesz.
- **E-mail kiküldés soha nem kapcsol be magától** (INV-2). A
  `setEmailOnSend(true)` sor törlendő. A kiküldés a 3. lépés explicit,
  látható kapcsolója, alapból **ki**.

**Okos alapértékek a céges profilból** (`useCompany()`), mind a Partner
lépésben, összecsukott „Dátumok és fizetés" blokkban, szerkeszthetően:

| Mező | Alapérték | Forrás |
|---|---|---|
| Pénznem | `company.defaultCurrency ?? "HUF"` | céges profil |
| Fizetési mód | `company.defaultPaymentMethod ?? "transfer"` | céges profil |
| Bankszámla | `company.bankAccount` | céges profil |
| Fizetési határidő | `company.defaultPaymentTermDays ?? 8` | céges profil |
| Kiállítás / teljesítés dátuma | ma | — |
| ÁFA kezelés (új tétel) | `company.vatExempt ? "aam" : "normal"` | céges profil (**már működik**, meg kell tartani) |
| ÁFA kulcs | AAM → 0 %, egyébként 27 % | `lib/invoices/vat.ts` |

> Ha a `company` objektumon egy default mező még nincs (pl.
> `defaultPaymentTermDays`), a composer a fenti fallbacket használja, és a
> hook-glue (`hooks/useCompany.ts`) **opcionális** mezőként olvassa —
> `db/schema.ts` nem módosul ebben a workflowban.

**Dátumok**: `DateField` komponens (`components/ui/date-field`), weben
`<input type="date">` a `*.web.tsx` ágon, natívon a mai szöveges mező +
maszk. Validáció: `dueDate >= issueDate`, különben mezőszintű hiba
(INV-8, D3). i18n: `invoices.errors.dueBeforeIssue`.

### 2.4 Lépés 2 — Tételek

**Desktop rács** (egy `Section` kártyán belül, fejlécsor + sorok):

```
Megnevezés            Menny.  Egység   Egységár   ÁFA        Nettó      Bruttó   ⋯
[Tanácsadás      ▾]   [ 1  ]  [ óra ▾] [450 000]  [27% ▾]   450 000 Ft 571 500 Ft ⋯
[+ Tétel hozzáadása]   [+ Termék a katalógusból]
```

- Oszlopszélességek: Megnevezés `flex-1` (min 240), Menny. 88, Egység 96,
  Egységár 140, ÁFA 132, Nettó 132 (jobbra), Bruttó 140 (jobbra,
  `font-semibold`), `⋯` 44. Számok **jobbra zártak, `font-variant-numeric:
  tabular-nums`** (lásd 4.6).
- **Inline szerkesztés**: minden cella egy mező, nincs külön „Tétel 1"
  kártyafejléc és nincs 5 külön `FormControl` blokk soronként.
- **Termékválasztó** (INV-5, P1): a Megnevezés mező autocomplete a
  `useProducts()` katalógusra. Kiválasztásra kitölti: megnevezés, egységár,
  ÁFA kulcs, mértékegység. Szabad szöveg továbbra is megengedett.
- **Mértékegység** oszlop (INV-6, R2): `unit` string, alapértéke `db` (darab),
  javasolt opciók: `db`, `óra`, `nap`, `hó`, `km`, `kg`, `m²`, `alkalom`.
  > **Adó/NAV gate:** a mértékegység *megjelenítése és tárolása* UI-munka, de
  > az Áfa tv. 169. § szerinti kötelezőség kérdése tulajdonosi megerősítést
  > igényel. A `unit` mező opcionális marad a típusban, a UI nem kényszeríti
  > ki, és a NAV-beküldés logikája **nem** módosul. Ha a mező nincs az
  > `InvoiceLineItem` típuson, a track hozzáadja a **típushoz és a UI-hoz**,
  > `db/schema.ts`-hez nem nyúl; a perzisztencia külön queue-item.
- **ÁFA kezelés** (INV-7): `VatCategoryPicker` = egy legördülő két gyakori
  opcióval (`Adóköteles`, `AAM`), alatta „Speciális adózás" link, ami kinyitja
  a maradék ötöt (TAM, KBAET, AHK, FAD, ATK) a hosszú magyarázó szöveggel.
  A 7 chip két sorban megszűnik.
- **Élő összesítés**: minden sor alatt nincs külön „Tétel összesen" szöveg;
  a Nettó/Bruttó oszlop adja. A rács alatt jobbra zárt blokk:
  `Nettó összesen` / `ÁFA (27%)` / `ÁFA (AAM 0%)` kulcsonként bontva /
  **`Bruttó összesen`** félkövéren. Az ÁFA sor kötelező (INV-13).
- **Mobil**: soronként kártya, fejléc `Tétel 1 · 571 500 Ft` + `⋯`;
  a mezők 2 oszlopos rácsban (Menny./Egység, Egységár/ÁFA), Megnevezés
  teljes szélesség. A jelenlegi törlés-megerősítés marad.

### 2.5 Lépés 3 — Ellenőrzés & küldés

Egy `Section`-okra bontott, **olvasható összefoglaló**, minden blokk mellett
„Szerkesztés" link, ami a megfelelő lépésre ugrik:

1. **Partner** — név, adószám, cím, e-mail.
2. **Dátumok és fizetés** — teljesítés, kelt, határidő (`… nap`), fizetési
   mód, bankszámla, pénznem (+ árfolyam).
3. **Tételek** — kompakt táblázat, nettó/ÁFA/bruttó.
4. **Kiküldés és megfelelőség** — két kapcsoló, **mindkettő alapból ki**,
   a következményt kimondva:
   - „Bizonylat elküldése e-mailben ({{email}} címre)" — ha nincs e-mail,
     a kapcsoló letiltott + hint.
   - „Beküldés a NAV Online Számla rendszerbe" — a meglévő `navEnabled`
     viselkedés, változatlan logikával.
5. **Megjegyzés** — szabad szöveg. A `composeInvoiceNotes()` által gyártott
   szövegkása **nem kerül** a `notes` mezőbe (INV-12): a fizetési mód,
   bankszámla, teljesítés és számlázási cím strukturált mezőként utazik
   tovább (`paymentMethod`, `bankAccount` ha van, `fulfillmentDate`,
   partner mezők), a `notes` **csak a felhasználó saját szövege**.
   > Ha a preview/PDF generátor ma a `notes`-ból olvassa ki ezeket, a
   > composer track a `buildDraftInvoice()`-ot bővíti strukturált mezőkkel,
   > és a `composeInvoiceNotes()` hívást eltávolítja a composerből. A
   > PDF/HTML sablon magyarítása (INV-10, B2) **nem ebben a workflowban**
   > történik — külön queue-item, mert kimenő bizonylatot érint.

**Műveletek (a `PageHeader`-ben és a mobil láblécben, azonos jelentéssel):**

| Gomb | Stílus | Mit csinál | Eredmény státusz |
|---|---|---|---|
| `Mentés piszkozatként` | outline | ment, marad a képernyőn, toast | `draft` |
| `Véglegesítés` | **solid (elsődleges)** | számlaszámot kap, nem küld semmit | `unpaid` |
| `Véglegesítés és küldés` | solid, a `Véglegesítés ▾` menüjében | ment + e-mail kiküldés | `sent` |

> **INV-15 javítása:** a `sent` státusz csak akkor kerül mentésre, ha tényleg
> volt kiküldés. Ez tisztán UI/glue döntés a meglévő `InvoiceStatus`
> értékkészleten belül — **nincs schema- vagy NAV-változás**. A díjbekérő
> továbbra is `proforma`.

Mentés után: **toast** („A(z) {{number}} számla elkészült"), majd
`router.replace(routes.invoiceDetail(saved.id))` — a részletnézetre, nem a
listára (INV-15).

### 2.6 Amit ki kell venni

| Mi | Miért | Hogyan |
|---|---|---|
| „Automatikusan mentve piszkozatként HH:MM" | **hazugság**, semmi nem mentődik (INV-1) | `savedAt` effect törlése. Helyette: `Nem mentett módosítások` jelzés, ha `isDirty`, és `Piszkozat mentve HH:MM` **csak sikeres mentési válasz után**. Weben `beforeunload` figyelmeztetés, ha `isDirty`. |
| „Nyugta" fül a bizonylattípusok között | adatvesztéssel navigál el (INV-14, E2) | A `DocumentTypeTabs` 3 fülre szűkül (Számla · Díjbekérő · Előlegszámla). Nyugtát a sidebar „Nyugták → Új nyugta" útján lehet készíteni. Szerkesztés közben a fülek **letiltottak**. |
| Validációs hiba az űrlap alján | 1200 px-rel a hibás mező alatt (INV-3) | Mezőszintű hiba (`FormField error`) + a hibás lépésre ugrás + fókusz az első hibás mezőre + a stepperben piros pötty a hibás lépésen. Ezen felül egy összegző sáv a lépés tetején. |
| Kötelezőség-jelölés hiánya | INV-4 | A `FormField` `required` propja `*` jelet és `aria-required`-et tesz. Kötelező: partner neve, legalább 1 tétel megnevezés + egységár. Semmi más. |

### 2.7 Szerkesztés ugyanazzal a struktúrával

`app/(app)/invoices/[id]/edit.tsx` **ugyanazt az `InvoiceComposer`-t**
rendereli `mode="edit"` proppal (E1):

- ugyanazok a lépések, mezők, alapértékek, összesítő, előnézet;
- a `PageHeader` címe `invoices.edit.title`, breadcrumb: Számlák / {szám} / Szerkesztés;
- a „Véglegesítés" gomb helyén `Változások mentése`;
- a meglévő **finalizált = csak olvasható** ág (`invoice.status !== "draft"`)
  változatlanul megmarad — ez már ma helyesen működik, ne rontsuk el.
  A read-only nézet is a composer összefoglaló (3. lépés) elrendezését
  használja, `readOnly` módban.

---

## 3. Listák, részletnézet, vezérlőpult

### 3.1 Számlalista — `/invoices`

**Desktop: `DataTable`** (L1 — a dashboard már tudja, a lista nem):

| Oszlop | Szél. | Tartalom | Igazítás |
|---|---|---|---|
| Sorszám | 132 | `INV-2026-008`, piszkozatnál `—` + „Piszkozat" | bal |
| Partner | flex-1 | név | bal |
| Kelt | 104 | `2026. 09. 13.` | bal |
| **Fizetési határidő** | 120 | dátum + `Lejárt 15 napja` piros alszöveg | bal |
| Státusz | 128 | `InvoiceStatusChip` | bal |
| NAV | 56 | pötty + tooltip | közép |
| **Bruttó** | 148 | összeg, `tabular-nums` | **jobb** |
| ⋯ | 44 | sor-menü | jobb |

- **Fizetési határidő + hátralék** az L2 kritikus hiánya — ez a leglényegesebb
  új oszlop.
- **Sor-menü (`⋯`)**: PDF letöltése · E-mail küldése · Fizetettnek jelölés ·
  Másolás · *(elválasztó)* · **Törlés** (piros, a menü alján). A piros kuka
  eltűnik a sorból (L4).
- **Sor hover**: `bg-muted/40`, kurzor pointer, teljes sor kattintható.
- **Szűrők**: egy `SegmentedFilter` sáv, `Összes · Piszkozat · Kiküldve ·
  Fizetetlen · Lejárt · Fizetve · Egyéb ▾` — **7 helyett 6 + menü**, minden
  chipen **darabszám** (`Lejárt (2)`). A kiválasztott chip `bg-primary
  text-primary-foreground`, a többi `bg-transparent border-border
  text-foreground` — a jelenlegi fordított olvasat megszűnik (L5).
- **Rendezés**: a Kelt / Határidő / Bruttó fejléc kattintható, nyíllal jelöli
  az irányt; alapértelmezés Kelt ↓ (L8). A rendezés kliens oldali, ha az API
  nem támogatja — a jelenlegi `INVOICE_LIST_LIMIT` lapméreten belül.
- **Statisztikák**: a 3 `StatCard` marad, de beszédes címkékkel (L7) és
  **pénznem-bontással** (L6): a „Havi összeg" kártya HUF-ban mutat, és ha
  van más pénznemű számla, alatta `+ 1 240,00 € más pénznemben` alszöveg.
  Vegyes pénznemek **soha nem adódnak össze** egy számmá.
  > A tényleges összegző számítás (`stats.monthlyTotal`) hitelességét a
  > `lists` track **nem** módosítja, csak a megjelenítést teszi őszintévé;
  > a számoló logika átvizsgálása külön (tax-érintett) queue-item.
- **Mobil: kártyák maradnak**, de a kártya megkapja a határidőt és a
  státuszchipet a jelenlegi színrendszerrel, a kuka pedig a `⋯` menübe kerül.
  „Gyors előnézet" link → `Előnézet` sor a `⋯` menüben (L9).

### 3.2 Számla részletei — `/invoices/[id]`

```
Számlák / INV-2026-010
┌───────────────────────────────────────────────────────────────────────┐
│ INV-2026-010          Green Energy Zrt.        [LEJÁRT]               │
│ 825,50 €                                        Lejárt 15 napja       │
│ Hátralék: 825,50 €                              [E-mail emlékeztető]  │  ← elsődleges
│                                                 [Fizetettnek jelölés] │  ← másodlagos
│                                                 [Továbbiak ▾]         │
└───────────────────────────────────────────────────────────────────────┘
┌── Státusz idővonal ───────────────────────────────────────────────────┐
│ ●Kiállítva 09.06 ──●Kiküldve 09.06 ──○Esedékes 08.23 (lejárt) ──○Fizetve│
│ NAV: ⬤ Beküldve 09.06 · tranzakció: 4XYZ…            [Részletek]      │
└───────────────────────────────────────────────────────────────────────┘
┌── 2 oszlop desktopon ─────────────────────┬───────────────────────────┐
│ Bizonylat előnézete (élő, 1 fül)          │ Adatok: partner, dátumok, │
│                                            │ fizetés, tételek, összegek│
└────────────────────────────────────────────┴───────────────────────────┘
Veszélyzóna (összecsukott):  Sztornó · Törlés
```

- **A fejléc mondja meg a pénzt** (D2): bruttó nagy számmal, hátralék, és ha
  lejárt, `Lejárt {{days}} napja` destruktív színnel. A `dueDate < today &&
  status ∈ {sent, unpaid, partially_paid}` esetén a képernyő **lejártként
  viselkedik** akkor is, ha a mentett státusz `sent` (D3) — ez megjelenítési
  származtatás, nem státuszírás.
- **Egy elsődleges művelet, státusz szerint** (D1):

  | Státusz | Elsődleges | Másodlagos |
  |---|---|---|
  | `draft` | Véglegesítés | Szerkesztés, Előnézet |
  | `sent` / `unpaid` | E-mail emlékeztető | Fizetettnek jelölés |
  | `overdue` | E-mail emlékeztető | Fizetettnek jelölés |
  | `partially_paid` | Fizetettnek jelölés | E-mail emlékeztető |
  | `paid` | PDF letöltése | Másolás |
  | `cancelled` | Másolás | — |

- **`Továbbiak ▾` menü**: Másolás · Helyesbítő számla · PDF letöltése ·
  Fizetési link (Revolut) · Fizetési link (Barion). A Revolut/Barion gombok
  kapnak magyarázó alszöveget a menüben („Fizetési link generálása") — D7.
- **Veszélyzóna** (`DangerZone`, összecsukott, `border-destructive/40`):
  Sztornó és Törlés, mindkettő a meglévő megerősítő párbeszéddel.
- **NAV blokk feljebb** — az idővonal sorába integrálva, nem a lap alján (D6).
- **Előnézet**: egy fül, nem „HTML | PDF" (INV-11). Alapból a HTML-render,
  „PDF letöltése" külön gomb. A PdfPreviewEmbed örök spinnerének
  kezelése: 10 s után hibaállapot + „Újra" (`StateView` error minta).
- **Mobil**: egy oszlop, a fejléc pénz-blokk marad felül, az akciók egy
  sticky lábléc sávban (elsődleges + `⋯`).

### 3.3 Vezérlőpult — `/dashboard`

**4 KPI, mind kattintható** (A4 — ma egyik sem vezet sehova):

| KPI | Érték | Alszöveg | Kattintás |
|---|---|---|---|
| Kintlévőség | kifizetetlen bruttó | `{{count}} számla` | `/invoices?status=unpaid` |
| Lejárt | lejárt bruttó (destruktív szín) | `{{count}} számla · legrégebbi {{days}} napja` | `/invoices?status=overdue` |
| E havi bevétel | kifizetett bruttó (érték **nem** zöld, csak a `paid` chip az) | `{{count}} kifizetett számla` | `/invoices?status=paid` |
| Becsült ÁFA | becsült fizetendő | **konkrét időszak**: `2026. III. negyedév · a kiállított számlák alapján` | `/invoices` |

- Az `A3` értelmetlen mondat („ez az egyenlege az időszaknak") helyére
  konkrét, forrásmegjelölő szöveg kerül: `dashboard.vatPeriodNote` új értéke
  hu: „Becslés a(z) {{period}} időszak kiállított számlái alapján. Nem
  adótanácsadás." / en: „Estimate based on invoices issued in {{period}}.
  Not tax advice." — **a számot nem módosítjuk**, csak a magyarázatot.
- A „legrégebbi: 0 napja" hibás szöveg: ha `oldestDays < 1`, `ma` szöveg
  (`dashboard.overdueToday`), nem „0 napja".
- **„Következő lépések"** kártya (`NextActionsCard`) — a KPI-k alatt,
  maximum 3 sor, mindegyik egy kattintással elvégezhető ugrással:
  1. `{{count}} lejárt számla — emlékeztető küldése` → szűrt lista
  2. `{{count}} piszkozat véglegesítésre vár` → szűrt lista
  3. `{{count}} számla nincs beküldve a NAV-hoz` → szűrt lista
  Ha egyik sem áll fenn: „Minden rendben. Nincs elintézetlen teendő."
  (`dashboard.nextActions.allClear`)
- **Bevétel statisztika kártya**: a jelmagyarázat-pöttyök diagram nélkül
  megszűnnek (A5). Helyette egy 8 px magas, 3 szegmensű vízszintes sáv
  (fizetett / kiküldött / kintlévő), a `paid` szegmens zöld, a többi
  cornflower és `muted` — narancs sehol (A5).
- **Legutóbbi számlák**: ugyanaz a `DataTable`, amit a lista használ
  (5 sor, „Minden számla →"). Egy komponens, egy vizuális nyelv (A1).
- **M2M demó panel**: `M2mDemoCard` a lap **aljára**, összecsukva,
  „Fejlesztői diagnosztika (demó)" címmel; az „OK" sorok **nem zöldek**
  (V5), a „Detailed ledger lines" i18n kulcsot kap (A2).
- **Fejléc**: breadcrumb törlése (A7); a jobb oldali két gomb közül a
  „Ügyfélszolgálat" a `⋯` menübe kerül, elsődleges művelet desktopon is
  az „Új számla" (A6) — de mivel a sidebar már hordozza, a dashboard fejléce
  **nem** duplikálja; elsődleges művelete `Bejövő számlák`.

### 3.4 Partnerek / Termékek / Nyugták listák

Mindhárom ugyanazt a mintát kapja (C3–C5, P1–P4, R6):

- `PageHeader` cím + darabszám alcím + egy elsődleges „Új …" gomb.
- **Kereső** mező a lista fölött (kliens oldali szűrés), 8+ elemnél kötelező.
- **Desktop: `DataTable`**, mobil: kártya. Partnerek: Név | Adószám | E-mail |
  Város | `⋯`. Termékek: Megnevezés | Egység | Nettó ár | ÁFA | `⋯`.
  Nyugták: Nyugtaszám | Ügyfél | Kelt | Bruttó | `⋯`.
- **Sor-menü**: Szerkesztés · *(partnernél)* **Számla ennek a partnernek** ·
  Törlés. A „Számla ennek a partnernek" a leggyakoribb szándék (C4) →
  `/invoices/new?clientId=…`, amit a composer előre kitöltve nyit.
- Kártyákon/sorokon látható interakció-jelzés: hover háttér + chevron (C4).
- Termékek ára a **cég pénznemében** jelenjen meg, ne EUR-ban egy magyar
  27 %-os kulcs mellett (P2): `formatCurrency(price, company.defaultCurrency
  ?? "HUF")`.
- Az `/receipts/new` hardcode angol sztringjei (`Item 1`, `Net price`, `Qty`,
  `VAT rate`) i18n kulcsot kapnak (R1) — lásd a `lists` track kulcslistáját.

---

## 4. Vizuális rendszer

### 4.1 Térköz-skála

Egyetlen skála, 4 px alapon. NativeWind osztályokkal:

| Token | px | Használat |
|---|---|---|
| `1` | 4 | ikon–szöveg, badge belső |
| `2` | 8 | mezőcímke–mező, chip belső |
| `3` | 12 | listaelemek között, kártya belső mobil |
| `4` | 16 | kártya belső padding mobil, mezők között |
| `5` | 20 | kártya belső padding desktop |
| `6` | 24 | szekciók között |
| `8` | 32 | oldal vízszintes padding desktop (`px-8`) |
| `10` | 40 | nagy szekcióközök |

**Tartalmi szélességek (V1 — ez a „nem szép" fő oka):**

| Konstans | Érték | Hol |
|---|---|---|
| `LAYOUT.shellMax` | 1440 | shell külső |
| `LAYOUT.contentMax` | **1200** | minden képernyő tartalma |
| `LAYOUT.formMax` | **720** | űrlaposzlop (mezők soha nem szélesebbek) |
| `LAYOUT.proseMax` | 640 | hosszú szöveg, magyarázó blokkok |

`components/layout/ScreenLayout.tsx` kap egy `width` propot
(`"content" | "form" | "full"`, alapértelmezés `"content"`), és a tartalmat
`mx-auto w-full max-w-[1200px]`-be zárja.

### 4.2 Tipográfia

`Ranade` a címekhez (`font-heading`), `Stack Sans Text` a törzshöz.

**A Ranade nem töltődik be az app dev szerverén** (V6) — a `@font-face`
`/marketing/assets/fonts/ranade-*.woff2`-re mutat, ami csak a rétegzett
produkciós buildben létezik. **Javítás:** a két `woff2` bemásolása
`assets/fonts/`-ba, és a `global.css` `@font-face` `src` erre mutat
(`/assets/fonts/ranade-500.woff2`), a marketing útvonal második `src`-ként
megtartva fallbacknek. A betöltés ellenőrizhető: `document.fonts.check("500
16px Ranade")` a dev szerveren `true`.

| Szint | Osztály | Méret / sormagasság | Használat |
|---|---|---|---|
| `display` | `font-heading text-[32px] leading-[38px] font-bold` | 32/38 | oldalcím desktopon (`PageHeader.title`) |
| `h1` | `font-heading text-2xl leading-8 font-bold` | 24/32 | oldalcím mobilon |
| `h2` | `font-heading text-lg leading-7 font-semibold` | 18/28 | `Section` cím |
| `h3` | `text-base leading-6 font-semibold` | 16/24 | kártyacím, táblázat-csoport |
| `body` | `text-sm leading-5` | 14/20 | törzs, mezőérték |
| `label` | `text-xs leading-4 font-medium uppercase tracking-wide text-muted-foreground` | 12/16 | táblázat-fejléc, mezőcímke-fölé |
| `caption` | `text-xs leading-4 text-muted-foreground` | 12/16 | hint, alszöveg |
| `metric` | `font-heading text-[28px] leading-8 font-bold tabular-nums` | 28/32 | KPI érték |
| `amount` | `text-sm font-semibold tabular-nums` | 14/20 | listaösszeg |
| `amountLg` | `font-heading text-2xl font-bold tabular-nums` | 24/32 | részletnézet bruttó |

Ezzel megszűnik az „egyetlen betűméret az egész appban" (V7): a 12 db számla
és a 171 450 Ft lejárt tartozás többé nem ugyanakkora.

### 4.3 Felületek, szegélyek, árnyékok

| Elem | Ma | Új |
|---|---|---|
| Kártya háttér | `bg-card` (#fff) | változatlan |
| Kártya szegély | `--border` #c5c7ca — túl nehéz (V8) | **`--border-subtle` = #e4e6e8** (typography100). Új CSS változó `global.css`-ben és `tokens.ts`-ben, Tailwind `border-subtle`. A `--border` megmarad az inputoknak/elválasztóknak. |
| Kártya rádiusz | `rounded-lg` (8) | **`rounded-xl` (12)** kártyákra, `rounded-lg` (8) mezőkre/gombokra, `rounded-full` chipekre |
| Árnyék | minden kártyán | **csak emelt felületen**: popover, modal, sticky lábléc, dropdown → `shadow-sm`. Sima kártya: szegély, árnyék nélkül. |
| Oldal háttér | `--background` #f6f6f8 | változatlan |
| Táblázat fejléc | `bg-muted/30` | `bg-muted/40` + `border-b border-subtle` |
| Táblázat sor | `border-b border-border` | `border-b border-subtle`, hover `bg-muted/40` |

A „dobozok dobozokban" ellen: **szekción belül nincs kártya kártyában**.
A `Section` adja a keretet; ami benne van, az sima tartalom.

### 4.4 Státuszszínek — egy forrás

Új: `lib/invoices/status-visuals.ts` (a meglévő `status-i18n.ts` mellé),
minden képernyő ezt használja (L3, V5 — ma három rendszer él párhuzamosan).

| Státusz | Chip | Szöveg | Szegély | Megjegyzés |
|---|---|---|---|---|
| `paid` | `bg-[#15803d]/10` | `text-[#15803d]` | `border-[#15803d]/30` | **az egyetlen zöld az appban** |
| `partially_paid` | `bg-amber-500/10` | `text-amber-700` | `border-amber-500/30` | |
| `sent` | `bg-primary/10` | `text-primary` | `border-primary/30` | |
| `unpaid` | `bg-muted` | `text-foreground` | `border-border` | |
| `overdue` | `bg-destructive/10` | `text-destructive` | `border-destructive/30` | |
| `draft` | `bg-muted` | `text-muted-foreground` | `border-border` | |
| `proforma` | `bg-accent` | `text-accent-foreground` | `border-primary/20` | narancs helyett pale blue |
| `cancelled` | `bg-muted/60` | `text-muted-foreground/70` | `border-border/50` | áthúzott sorszám a listában |

`InvoiceStatusChip` komponens (`components/invoices/InvoiceStatusChip.tsx`):
`rounded-full px-2.5 py-0.5 text-xs font-medium`, **nem uppercase** (a mai
`BadgeText` `uppercase` alapja túl kiabál a listán).

**Tiltás:** `bg-green-*`, `text-green-*` **kizárólag** `paid` kontextusban.
A NAV „OK" jelzés, az M2M demó és a dashboard legenda cornflower/muted.

### 4.5 Gomb-hierarchia (V9)

| Szint | Stílus | Szabály |
|---|---|---|
| Elsődleges | `variant="default"` (tömör cornflower) | **képernyőnként pontosan egy** |
| Másodlagos | `variant="outline"` | max 2 látható, a többi `⋯` menüben |
| Tercier | `variant="link"` / ghost | inline linkek, „Szerkesztés" |
| Romboló | `variant="outline"` + `text-destructive border-destructive/40` | csak menüben vagy veszélyzónában, soha nem a semleges műveletek sorában |

Gombméretek: `sm` = 32 px magas (táblázat-sor, chip mellett), `default` =
40 px, `lg` = 48 px (mobil lábléc, teljes szélesség).

### 4.6 Számok

Minden pénzösszeg és mennyiség: **jobbra zárt, `tabular-nums`**.
Weben `className="tabular-nums"` (Tailwind), natívon
`fontVariant: ["tabular-nums"]` a `Text` primitívben. Segéd:
`components/ui/text` kap egy `numeric` propot, ami mindkét platformon helyes.

### 4.7 Üres / betöltő / hiba állapotok

Egy komponens: `components/layout/StateView.tsx`

```tsx
<StateView
  kind="empty" | "loading" | "error"
  icon={FileText}
  title={t("invoices.empty.title")}
  description={t("invoices.empty.description")}
  action={<Button …/>}
  onRetry={() => …}       // kind="error"
/>
```

- **loading**: nem `ActivityIndicator` a semmi közepén — **skeleton**:
  a lista 5 szürke sorsáv (`bg-muted animate-pulse h-12 rounded-lg`),
  a kártyarács 3 skeleton kártya, a részletnézet 1 fejléc- + 3 sorsáv.
- **empty**: ikon (40 px, `text-muted-foreground/60`), cím `h3`, leírás
  `caption`, **egy** elsődleges művelet. Soha nem angol hardcode
  (`ListScreen` `emptyTitle = "Nothing here yet"` törlendő — V11).
- **error**: destruktív ikon, a hibaüzenet, `Újra` gomb. A PdfPreviewEmbed
  10 s után ide esik (INV-11).

### 4.8 Komponens-receptek (a közös alap)

Mind a `components/layout/` alatt, a `visual` track szállítja először.

```tsx
// PageHeader — minden képernyő teteje
type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];      // csak nem-legfelső szinten
  meta?: ReactNode;                   // chip / státusz a cím mellett
  primaryAction?: ReactNode;          // legfeljebb 1
  secondaryActions?: ReactNode;       // legfeljebb 2
  overflowActions?: ReactNode;        // „⋯" menü tartalma
  actions?: ReactNode;                // DEPRECATED, visszafelé kompatibilitás
};
```

```tsx
// Section — címkézett tartalmi blokk, kártyakeret nélküli beágyazással
type SectionProps = {
  title?: string;
  description?: string;
  action?: ReactNode;                 // jobbra, pl. „Szerkesztés"
  children: ReactNode;
  variant?: "card" | "plain";         // alapértelmezés: "card"
  className?: string;
};
```

```tsx
// DataTable — desktop táblázat, mobilon a hívó adja a kártyát
type Column<T> = {
  key: string;
  header: string;
  width?: number;                     // px; hiányában flex-1
  align?: "left" | "right" | "center";
  numeric?: boolean;                  // tabular-nums + jobbra
  render: (row: T) => ReactNode;
  sortable?: boolean;
};
type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  onRowPress?: (row: T) => void;
  rowActions?: (row: T) => ReactNode; // „⋯" menü
  sort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (key: string) => void;
  loading?: boolean;                  // → skeleton sorok
  empty?: ReactNode;                  // → StateView
};
```

```tsx
// FormField — mezőcímke + kötelezőség + hint + hiba, egy helyen
type FormFieldProps = {
  label: string;
  required?: boolean;                 // „*” + aria-required
  hint?: string;
  error?: string;                     // piros keret + üzenet a mező ALATT
  children: ReactNode;                // Input / Select / Switch / …
  className?: string;
};
```

```tsx
// StatCard — KPI, kattintható
type StatCardProps = {
  label: string;
  value: ReactNode;                   // „metric” tipográfia
  hint?: string;
  tone?: "neutral" | "positive" | "critical";  // positive = ZÖLD, csak fizetett
  icon?: LucideIcon;
  onPress?: () => void;               // → hover + chevron
  loading?: boolean;                  // → skeleton
};
```

Továbbá: `InvoiceStatusChip`, `StateView`, `DangerZone`, `OverflowMenu`
(`⋯` popover, weben `Pressable` + abszolút pozicionált lista,
`webDomProps` a `.web.tsx` ágon).

---

## 5. Megosztott alap (sharedFirst) — a `visual` track szállítja először

A többi három track ezekre az **API-kra** épít. A `visual` track ezeket
szállítja először, egyetlen commitban, a többi track pedig már a megállapodott
prop-alakra ír kódot, várakozás nélkül (a fájlokat a `visual` worktree hozza
létre; a többiek az egyeztetett útvonalról importálnak).

| Fájl | Export | Minimum, ami az első commitban kell |
|---|---|---|
| `lib/theme/layout.ts` | `LAYOUT = { shellMax:1440, contentMax:1200, formMax:720, proseMax:640, sidebarWidth:248, sidebarCollapsed:72, topStripHeight:56, desktopBreakpoint:1024 }` | konstansok |
| `lib/theme/tokens.ts` | `--border-subtle`, `--surface-raised` hozzáadása `themeTokens.light/dark`-hoz | tokenek |
| `global.css` | ugyanezek a CSS változók + javított Ranade `@font-face` | |
| `tailwind.config.js` | `colors.subtle`, `borderRadius` finomítás | |
| `components/layout/PageHeader.tsx` | a 4.8-beli `PageHeaderProps` (a régi `actions` prop **megmarad**) | |
| `components/layout/Section.tsx` | `SectionProps` | |
| `components/layout/DataTable.tsx` | `DataTableProps<T>`, `Column<T>` | |
| `components/layout/FormField.tsx` | `FormFieldProps` | |
| `components/layout/StateView.tsx` | `StateViewProps` | |
| `components/layout/StatCard.tsx` | bővített `StatCardProps` (régi `label/value/hint` megmarad) | |
| `components/layout/OverflowMenu.tsx` | `{ items: {label, onPress, icon?, destructive?}[] }` | |
| `components/layout/DangerZone.tsx` | `{ title, description, children }` | |
| `components/invoices/InvoiceStatusChip.tsx` | `{ status, size? }` | |
| `lib/invoices/status-visuals.ts` | `STATUS_VISUALS: Record<InvoiceStatus, {chip, text, border}>`, `isOverdue(invoice, now)`, `overdueDays(invoice, now)` | |
| `components/ui/date-field/` | `DateField` (+ `.web.tsx` `<input type="date">`) | |

**Visszafelé kompatibilitás kötelező:** a `PageHeader`, `StatCard`,
`ScreenLayout`, `ListScreen` meglévő propjai **nem törhetnek el**, mert a
másik három track párhuzamosan használja őket. Új prop csak opcionálisként.

**i18n ütközés elkerülése:** mind a négy track nyúl a `hu.ts`/`en.ts`-hez.
Ezért **névtér-tulajdonlás**:

| Track | Saját i18n névterek |
|---|---|
| `visual` | `common.*`, `states.*` |
| `shell` | `nav.*`, `notifications.banner.*`, `userMenu.*` |
| `invoice-create` | `invoices.composer.*`, `invoices.fields.*`, `invoices.errors.*`, `invoices.actions.*`, `invoices.vat.*`, `invoices.lineItemEditor.*` |
| `lists` | `invoices.list.*`, `invoices.detail.*`, `invoices.timeline.*`, `dashboard.*`, `partners.*`, `products.*`, `receipts.*` |

Más track névterébe **senki nem ír**. Ha egy kulcs kell egy másik névtérből,
csak olvassa. Merge konfliktus így legfeljebb a fájl végén, mechanikusan
feloldható.

---

## 6. A négy párhuzamos track

### Track A — `shell` (navigáció, app shell, oldalfejlécek)

**Cél:** a brief „a menü nem világos" panasza. Desktop oldalsáv 6 elsődleges
szekcióval, állandó „Új számla", felhasználói menü, mobil tabok + FAB.

**Érintendő fájlok**

- `components/navigation/AppShell.tsx` (átírás: sidebar + topstrip vs. mobil)
- `components/navigation/AppSidebar.tsx` (új) + `.test.tsx`
- `components/navigation/AppTopStrip.tsx` (új) + `.test.tsx`
- `components/navigation/UserMenu.tsx` (új) + `.test.tsx`
- `components/navigation/MobileTabBar.tsx` (kiemelés az `AppShell`-ből) + `.test.tsx`
- `components/navigation/MoreSheet.tsx` (új, mobil „Továbbiak") + `.test.tsx`
- `components/navigation/MobileAppHeader.tsx` (monogram-javítás)
- `components/navigation/DesktopTopBar.tsx` (**törlés**, a teszttel együtt)
- `components/navigation/SettingsNav.tsx` (új, `/settings/*` másodlagos nav)
- `components/notifications/NotificationBanner.tsx` (bezárhatóság, i18n)
- `lib/app-navigation.ts` (+ `lib/app-navigation.test.ts`)
- `app/(app)/_layout.tsx` (csak ha a shell-váltás megköveteli)
- `app/(app)/settings/index.tsx` + `_layout` (a `SettingsNav` beillesztése,
  „Demo adatok" gomb lefokozása outline-ra a hub alján — S1)
- `lib/i18n/locales/hu.ts`, `en.ts` — **csak** `nav.*`, `notifications.banner.*`, `userMenu.*`
- `e2e/web/navigation.spec.ts`

**Nem nyúl hozzá:** `components/layout/*` (a `visual` track tulajdona),
`app/(app)/invoices/**`, `app/(app)/dashboard/**`,
`app/(app)/clients|products|receipts/**`, `lib/theme/*`, `global.css`,
`tailwind.config.js`.

**i18n kulcsok**

```
nav.dashboard        → hu: "Vezérlőpult"            en: "Dashboard"      (érték módosul)
nav.partners         → hu: "Partnerek"              en: "Partners"       (új)
nav.more             → hu: "Továbbiak"              en: "More"           (új)
nav.collapseSidebar  → hu: "Oldalsáv összecsukása"  en: "Collapse sidebar"
nav.expandSidebar    → hu: "Oldalsáv kinyitása"     en: "Expand sidebar"
nav.primarySections  → hu: "Fő menü"                en: "Main menu"
userMenu.account     → hu: "Fiókbeállítások"        en: "Account settings"
userMenu.company     → hu: "Céges profil"           en: "Company profile"
userMenu.signOut     → hu: "Kijelentkezés"          en: "Sign out"
notifications.banner.navPending → hu: "NAV beküldésre vár"    en: "NAV submission pending"
notifications.banner.more       → hu: "+{{count}} további"    en: "+{{count}} more"
notifications.banner.dismiss    → hu: "Elrejtés"              en: "Dismiss"
settings.navTitle    → hu: "Beállítások"            en: "Settings"
settings.backToHub   → hu: "Vissza a beállításokhoz" en: "Back to settings"
```

**Elfogadási kritériumok** (mind gépi vagy képernyőképpel ellenőrizhető)

1. **[desktop 1440]** Az oldalsáv látható, és pontosan ezt a 6 elsődleges
   szekciót tartalmazza, ebben a sorrendben: Vezérlőpult, Számlák, Nyugták,
   Partnerek, Termékek, Beállítások (+ Importálás és Admin a divider alatt).
2. **[desktop 1440]** `/clients`, `/products`, `/receipts`, `/import`
   mindegyike elérhető **URL beírása nélkül**, egy kattintással az
   oldalsávból. E2E: kattintás után az URL a várt route.
3. **[desktop 1440]** Az „+ Új számla" gomb az oldalsáv tetején minden
   `(app)` útvonalon látszik, és `/invoices/new`-ra navigál.
4. **[desktop 1440]** Az aktív nav-elemnek van háttere **és** bal oldali
   jelölősávja; az aktív és inaktív elem megkülönböztethető háttérszín
   alapján is (nem csak `font-weight`-ben). Teszt: az aktív sor
   `className`-je tartalmazza a `bg-white/14`-et (vagy a megegyezett tokent).
5. **[desktop 1440]** Nincs a shellben hardcode hex szín; `bg-[#1f305e]`,
   `#f9f9f9`, `#c5c7ca`, `bg-[#111f4a]` nem fordul elő a
   `components/navigation/**`-ban. Teszt: grep-alapú unit assert.
6. **[desktop 1440]** Az avatar megnyit egy menüt Fiókbeállítások / Céges
   profil / Kijelentkezés elemekkel; a Kijelentkezés egy kattintással kijelentkeztet.
7. **[desktop 1440]** Az értesítési szalag magyar szövegű HU nyelven,
   bezárható, és bezárás után nem tér vissza a munkamenetben.
8. **[desktop 1440]** `/settings/pdf`-ről egy kattintással vissza lehet jutni
   a Beállítások hubra (breadcrumb vagy `SettingsNav`).
9. **[mobil 375]** Az alsó tab bar 5 elemű, középen a kiemelt FAB-stílusú „+",
   és a tabok: Számlák · Partnerek · + · Vezérlőpult · Továbbiak.
10. **[mobil 375]** A „Továbbiak" lap tartalmazza a Nyugták, Termékek,
    Importálás, Beállítások elemeket, és mindegyik navigál.
11. **[mobil 375]** A fejléc monogramja a **felhasználó** nevéből képződik
    (teszt: `userName="Teszt Elek"`, `companyName="InvoHub Demo"` → `TE`).
12. **[mindkettő]** `npm run test:unit` zöld; új tesztek:
    `AppSidebar.test.tsx`, `MobileTabBar.test.tsx`, `UserMenu.test.tsx`,
    `MoreSheet.test.tsx`, bővített `lib/app-navigation.test.ts`.
13. **[mindkettő]** Minden új sztringnek van `hu` **és** `en` kulcsa; nincs
    hardcode felhasználói szöveg a `components/navigation/**`-ban.
14. **[desktop 1440]** 1024–1279 px között az oldalsáv összecsukott
    (ikon-only), és kinyitható; az állapot túléli az oldalfrissítést.

---

### Track B — `invoice-create` (új + szerkesztés számla)

**Cél:** a brief „a számlakészítés bonyolult" panasza + INV-1…INV-19, E1–E3.

**Érintendő fájlok**

- `app/(app)/invoices/new.tsx` (vékony route, a composert rendereli)
- `app/(app)/invoices/[id]/edit.tsx` (ugyanaz `mode="edit"`)
- `components/invoices/composer/**` (új, a 2.2-beli fájllista) + tesztek
- `components/invoices/LineItemEditor.tsx` (átalakítás rács/kártya kettősre,
  vagy kiváltás `StepLineItems` + `LineItemRow`-val; a meglévő teszt
  viselkedése megtartandó)
- `components/invoices/DocumentTypeTabs.tsx` (3 fül, „Nyugta" eltávolítása)
- `components/invoices/InvoicePreviewModal.tsx` (teljes előnézet modal)
- `lib/invoices/build-draft-invoice.ts` (strukturált mezők, `unit`,
  a „Sample line item" angol hardcode eltávolítása)
- `lib/invoices/client-form-fields.ts` (`composeInvoiceNotes` kivezetése a
  composerből; a függvény maradhat, ha máshol használt)
- `lib/invoices/vat.ts` — **csak** a „gyakori vs. speciális" csoportosítás
  exportja (`COMMON_VAT_CATEGORIES`, `SPECIAL_VAT_CATEGORIES`);
  a kategóriák jelentése és az adószámítás **nem** módosul
- `hooks/useCompany.ts` — opcionális default mezők olvasása (nem kötelező)
- `lib/i18n/locales/hu.ts`, `en.ts` — **csak** `invoices.composer.*`,
  `invoices.fields.*`, `invoices.errors.*`, `invoices.actions.*`,
  `invoices.vat.*`, `invoices.lineItemEditor.*`
- `e2e/web/invoices.spec.ts` (a létrehozási folyamat része)

**Nem nyúl hozzá:** `app/(app)/invoices/index.tsx`,
`app/(app)/invoices/[id]/index.tsx`, `app/(app)/dashboard/**`,
`components/invoices/InvoiceCard.tsx`, `components/navigation/**`,
`components/layout/**`, `lib/theme/*`, `global.css`, `db/schema.ts`,
`lib/nav/**`, `lib/tax/**`.

**i18n kulcsok (kivonat, mind hu + en)**

```
invoices.composer.step1                 "Partner" / "Client"
invoices.composer.step2                 "Tételek" / "Line items"
invoices.composer.step3                 "Ellenőrzés & küldés" / "Review & send"
invoices.composer.stepOf                "{{current}}/{{total}} · {{name}}"
invoices.composer.partnerSearch         "Partner keresése név vagy adószám alapján"
invoices.composer.partnerRecent         "Legutóbbi partnerek"
invoices.composer.partnerNew            "+ Új partner"
invoices.composer.partnerEdit           "Adatok szerkesztése"
invoices.composer.partnerMissingField   "a partnernél nincs megadva"
invoices.composer.datesPaymentToggle    "Dátumok és fizetés"
invoices.composer.addFromCatalog        "Termék a katalógusból"
invoices.composer.reviewEdit            "Szerkesztés"
invoices.composer.sendSection           "Kiküldés és megfelelőség"
invoices.composer.sendEmailTo           "Bizonylat elküldése e-mailben ({{email}} címre)"
invoices.composer.sendEmailNoAddress    "Adj meg partner e-mail címet a küldéshez."
invoices.composer.unsavedChanges        "Nem mentett módosítások"
invoices.composer.draftSavedAt          "Piszkozat mentve {{time}}-kor"
invoices.composer.leaveConfirm          "Vannak nem mentett módosítások. Biztosan kilépsz?"
invoices.composer.specialVat            "Speciális adózás"
invoices.composer.summaryNet            "Nettó összesen"
invoices.composer.summaryVat            "ÁFA"
invoices.composer.summaryVatRate        "ÁFA ({{rate}}%)"
invoices.composer.summaryGross          "Bruttó összesen"
invoices.composer.fullPreview           "Teljes előnézet"
invoices.composer.stepIncomplete        "Ez a lépés még hiányos"
invoices.fields.unit                    "Mértékegység" / "Unit"
invoices.fields.unitOptions.piece       "db" / "pcs"
invoices.fields.unitOptions.hour        "óra" / "hour"
invoices.fields.unitOptions.day         "nap" / "day"
invoices.fields.unitOptions.month       "hó" / "month"
invoices.actions.finalize               "Véglegesítés" / "Finalize"
invoices.actions.finalizeAndSend        "Véglegesítés és küldés" / "Finalize and send"
invoices.actions.saveDraft              "Mentés piszkozatként" / "Save as draft"   (érték finomítás)
invoices.actions.saveChanges            "Változások mentése" / "Save changes"
invoices.errors.dueBeforeIssue          "A fizetési határidő nem lehet korábbi a kiállítás dátumánál."
invoices.errors.lineItemPriceRequired   "Adj meg egységárat a tételhez."
invoices.errors.fixStep                 "Javítsd a hibát a(z) „{{step}}" lépésben."
invoices.success.created                "A(z) {{number}} számla elkészült."
invoices.success.draftSaved             "A piszkozat elmentve."
```

**Elfogadási kritériumok**

1. **[desktop 1440]** A `/invoices/new` első képernyőjén az első tételig
   **legfeljebb 3 látható kötelező/elsődleges vezérlő** van (partner kereső +
   „Dátumok és fizetés" összecsukott blokk + „Tovább"). A 14 mezős kártya
   megszűnt. E2E: a Partner lépésen a látható `input` elemek száma ≤ 3.
2. **[desktop 1440]** A partner kereső **az összes** partnert megtalálja, nem
   csak az első 8-at. Teszt: 12 partneres fixture-nél a 12. is kiválasztható
   gépeléssel.
3. **[desktop 1440]** Mentett partner kiválasztása **nem kapcsolja be** az
   e-mail kiküldést. Teszt: `handleSelectClient` után `emailOnSend === false`
   (unit), és a 3. lépésen a kapcsoló kikapcsolt állapotban jelenik meg.
4. **[desktop 1440]** Az „Automatikusan mentve piszkozatként" szöveg **sehol
   nem jelenik meg** mentési hálózati hívás nélkül. Teszt: gépelés után az
   `invoices.autoSavedAt` / `invoices.composer.draftSavedAt` szöveg nem
   látható; sikeres `Mentés piszkozatként` után igen.
5. **[desktop 1440]** A jobb oldali összesítő **mindig** látszik, és élőben
   frissül: mennyiség/egységár módosítására a Nettó, ÁFA és Bruttó érték
   azonnal változik. Az összesítőben **van ÁFA sor** (INV-13).
6. **[desktop 1440]** Az előnézet **nem cseréli le** az űrlapot; a lépések és
   a lábléc előnézet közben is elérhetők.
7. **[desktop 1440]** A tételsor rácsban szerkeszthető, és tartalmaz
   Mértékegység oszlopot; a katalógusból választott termék kitölti a
   megnevezést, egységárat és ÁFA kulcsot.
8. **[desktop 1440]** Az ÁFA kezelés alapból **2 opciót** mutat; a maradék 5
   csak a „Speciális adózás" kinyitása után látszik.
9. **[desktop 1440]** Üres partnernévvel a „Véglegesítés" **a hibás mezőnél**
   mutat hibát (a mező alatt, piros kerettel), a stepper a Partner lépést
   hibásnak jelöli, és a fókusz a mezőre ugrik. Nem az oldal alján jelenik meg.
10. **[desktop 1440]** A „Véglegesítés" `unpaid` státuszú számlát ment; a
    „Véglegesítés és küldés" `sent`-et, és csak ez utóbbi hív
    `/api/invoices/:id/send`-et. Unit teszt a `useInvoiceComposer` mentési
    ágán.
11. **[desktop 1440]** Mentés után toast jelenik meg, és a felhasználó a
    **részletnézeten** landol, nem a listán.
12. **[desktop 1440]** A „Nyugta" fül eltűnt a bizonylattípusok közül;
    szerkesztés közben a típusfülek letiltottak.
13. **[desktop 1440]** `/invoices/[id]/edit` **ugyanazokat a mezőket**
    kínálja, mint a létrehozás (cím, irányítószám, e-mail, teljesítés dátuma,
    határidő-gyorsgomb, bankszámla), és ugyanazt az összesítőt mutatja.
    Teszt: a két route ugyanazt az `InvoiceComposer` komponenst rendereli.
14. **[desktop 1440]** Finalizált (nem `draft`) számla szerkesztése továbbra
    is csak olvasható, a meglévő figyelmeztetéssel.
15. **[desktop 1440]** Egy mező sem szélesebb 720 px-nél.
16. **[mobil 375]** A lebegő lábléc **legfeljebb 120 px** magas, és egy sorban
    tartalmazza a fő műveleteket; az űrlapból legalább 400 px látszik.
17. **[mobil 375]** A KeyboardAvoidingView megmarad: a lap alján fókuszált
    mező nem kerül a billentyűzet mögé.
18. **[mindkettő]** `npm run test:unit` zöld; új tesztek a composer
    lépéseire, a partnerkeresőre, a tételrács számításaira és a mentési ágakra.
19. **[mindkettő]** Nincs hardcode felhasználói sztring a
    `components/invoices/composer/**`-ban; minden kulcs `hu` + `en`.

---

### Track C — `lists` (számlalista, részletnézet, dashboard, listák polírozása)

**Cél:** „ki tartozik nekem és mióta" egy pillantásra; L1–L9, D1–D7, A1–A7,
C1–C5, P1–P4, R1–R6.

**Érintendő fájlok**

- `app/(app)/invoices/index.tsx`
- `app/(app)/invoices/[id]/index.tsx`
- `app/(app)/dashboard/index.tsx`
- `app/(app)/clients/index.tsx`, `app/(app)/clients/new.tsx`, `[id]/edit.tsx`
- `app/(app)/products/index.tsx`, `[id]/edit.tsx`
- `app/(app)/receipts/index.tsx`, `new.tsx`, `[id]/index.tsx` (**R1: az
  angol hardcode-ok i18n kulcsra cserélése**)
- `components/invoices/InvoiceCard.tsx` (mobil kártya, `⋯` menü)
- `components/invoices/InvoiceListRow.tsx` (új, desktop sor) + teszt
- `components/invoices/InvoiceTimeline.tsx` (új) + teszt
- `components/invoices/InvoiceMoneyHeader.tsx` (új) + teszt
- `components/dashboard/NextActionsCard.tsx` (új) + teszt
- `components/dashboard/M2mDemoCard.tsx` (lefokozás, zöld eltávolítása, i18n)
- `hooks/useDashboardSummary.ts` (csak ha új, származtatott mező kell —
  **a meglévő számításokat nem írjuk át**)
- `lib/i18n/locales/hu.ts`, `en.ts` — **csak** `invoices.list.*`,
  `invoices.detail.*`, `invoices.timeline.*`, `dashboard.*`, `partners.*`,
  `products.*`, `receipts.*`
- `e2e/web/invoices.spec.ts`, `e2e/web/dashboard.spec.ts`

**Nem nyúl hozzá:** `app/(app)/invoices/new.tsx`,
`app/(app)/invoices/[id]/edit.tsx`, `components/invoices/composer/**`,
`components/invoices/LineItemEditor.tsx`, `components/navigation/**`,
`components/layout/**`, `lib/theme/*`, `global.css`, `tailwind.config.js`,
`db/schema.ts`, `lib/nav/**`, `lib/tax/**`,
**`lib/invoices/calculations.ts` összegző logikája**.

**i18n kulcsok (kivonat, mind hu + en)**

```
invoices.list.columnNumber       "Sorszám"        invoices.list.columnPartner "Partner"
invoices.list.columnIssued       "Kelt"           invoices.list.columnDue     "Fizetési határidő"
invoices.list.columnStatus       "Státusz"        invoices.list.columnGross   "Bruttó"
invoices.list.overdueDays        "Lejárt {{days}} napja"
invoices.list.dueInDays          "Esedékes {{days}} nap múlva"
invoices.list.dueToday           "Ma esedékes"
invoices.list.filterCount        "{{label}} ({{count}})"
invoices.list.sortBy             "Rendezés: {{column}}"
invoices.list.total              "Összes számla"           (érték finomítás — L7)
invoices.list.thisMonth          "E hónapban kiállítva"    (érték finomítás)
invoices.list.monthlyTotal       "E havi kiállított összeg"(érték finomítás)
invoices.list.otherCurrencies    "+ {{amount}} más pénznemben"
invoices.list.rowActions         "További műveletek"
invoices.detail.outstanding      "Hátralék"
invoices.detail.paidInFull       "Teljesen kifizetve"
invoices.detail.dangerZone       "Visszafordíthatatlan műveletek"
invoices.detail.dangerZoneHint   "A sztornó és a törlés nem vonható vissza."
invoices.detail.paymentLinkHint  "Fizetési link generálása"
invoices.timeline.issued         "Kiállítva"
invoices.timeline.sent           "Kiküldve"
invoices.timeline.due            "Esedékes"
invoices.timeline.paid           "Fizetve"
invoices.timeline.navSubmitted   "NAV-hoz beküldve"
invoices.timeline.pending        "Függőben"
dashboard.kpi.outstanding        "Kintlévőség"
dashboard.kpi.overdue            "Lejárt"
dashboard.kpi.revenueThisMonth   "E havi bevétel"
dashboard.kpi.estimatedVat       "Becsült fizetendő ÁFA"
dashboard.vatPeriodNote          "Becslés a(z) {{period}} időszak kiállított számlái alapján. Nem adótanácsadás."
dashboard.overdueToday           "a legrégebbi ma járt le"
dashboard.nextActions.title      "Következő lépések"
dashboard.nextActions.overdue    "{{count}} lejárt számla — emlékeztető küldése"
dashboard.nextActions.drafts     "{{count}} piszkozat véglegesítésre vár"
dashboard.nextActions.nav        "{{count}} számla nincs beküldve a NAV-hoz"
dashboard.nextActions.allClear   "Minden rendben. Nincs elintézetlen teendő."
dashboard.devDiagnostics         "Fejlesztői diagnosztika (demó)"
partners.title                   "Partnerek"      partners.add "Új partner"
partners.search                  "Keresés név vagy adószám alapján"
partners.invoiceFor              "Számla ennek a partnernek"
partners.columnName/TaxNumber/Email/City
products.add                     "Új termék"      products.search "Keresés megnevezés alapján"
products.columnName/Unit/NetPrice/Vat
receipts.add                     "Új nyugta"      receipts.search "Keresés"
receipts.item                    "{{index}}. tétel"
receipts.netPrice                "Nettó egységár"
receipts.quantity                "Mennyiség"
receipts.vatRate                 "ÁFA kulcs"
```

**Elfogadási kritériumok**

1. **[desktop 1440]** `/invoices` táblázatot rendel (nem kártyalistát), és a
   fejléc tartalmazza: Sorszám, Partner, Kelt, **Fizetési határidő**, Státusz,
   NAV, Bruttó.
2. **[desktop 1440]** Egy lejárt számla sorában a határidő alatt
   `Lejárt {{days}} napja` szöveg áll destruktív színnel.
3. **[desktop 1440]** A Bruttó oszlop jobbra zárt és `tabular-nums`; egy
   képernyőn legalább 10 sor elfér (soronként ≤ 56 px).
4. **[desktop 1440]** A `FIZETVE` státusz **zöld** (`#15803d` család) minden
   felületen — listán, dashboardon, részletnézeten egyaránt, és ugyanaz a
   `InvoiceStatusChip` rendereli mindet. Teszt: a három képernyő ugyanabból a
   `STATUS_VISUALS` mapből olvas.
5. **[desktop 1440]** A kiválasztott szűrő-chip kontrasztosabb, mint a nem
   kiválasztott (`bg-primary` vs. átlátszó), és minden chipen darabszám van.
6. **[desktop 1440]** A sorban **nincs** piros kuka; a törlés a `⋯` menü
   alján, destruktív stílussal, megerősítéssel.
7. **[desktop 1440]** A lista rendezhető Kelt / Határidő / Bruttó szerint, és
   az aktív rendezés látszik a fejlécen.
8. **[desktop 1440]** A „Havi összeg" kártya nem ad össze eltérő pénznemeket:
   vegyes fixture-nél megjelenik a `+ {{amount}} más pénznemben` alszöveg.
9. **[desktop 1440]** `/invoices/[id]` fejléce mutatja a bruttót nagy
   számmal, a hátralékot, és lejárt számlánál a `Lejárt {{days}} napja`
   szöveget — akkor is, ha a tárolt státusz `sent` (származtatott lejártság).
10. **[desktop 1440]** A részletnézeten **pontosan egy** tömör gomb van, és a
    Sztornó/Törlés a veszélyzónában (vagy a `⋯` menüben destruktív stílussal),
    nem a semleges műveletek sorában. A 11 egyforma gomb megszűnt.
11. **[desktop 1440]** A részletnézeten van státusz-idővonal
    (Kiállítva → Kiküldve → Esedékes → Fizetve) + NAV állapot, a
    dokumentum-előnézet **fölött**.
12. **[desktop 1440]** A dokumentum-előnézet egy nézet (nincs „HTML | PDF"
    fülpár), és 10 s után hibaállapotot mutat „Újra" gombbal a végtelen
    spinner helyett.
13. **[desktop 1440]** A dashboard 4 KPI kártyája mind kattintható, és a várt
    szűrt listára navigál.
14. **[desktop 1440]** A „Becsült fizetendő ÁFA" alatti mondat megnevezi az
    időszakot és tartalmazza a „Nem adótanácsadás" kitételt. **A szám nem
    változik.**
15. **[desktop 1440]** A „Következő lépések" kártya megjelenik, legfeljebb 3
    sorral, és üres esetben az „allClear" szöveggel.
16. **[desktop 1440]** Az M2M demó panel a lap alján, összecsukva, „(demó)"
    jelöléssel, és **nincs benne zöld szín**.
17. **[desktop 1440]** `/clients`, `/products`, `/receipts` mindegyike:
    keresőmezővel, desktop táblázattal, sor-menüvel, és egységes „Új …"
    elsődleges gombbal. A partner sor-menüjében van „Számla ennek a
    partnernek", ami `/invoices/new`-ra navigál a partner előkiválasztásával.
18. **[desktop 1440]** Az `/receipts/new` képernyőn **nincs angol hardcode**:
    az „Item 1", „Net price", „Qty", „VAT rate" magyar/angol i18n kulcsból jön.
    Teszt: grep az `app/(app)/receipts/**`-ra ezekre a literálokra → 0 találat.
19. **[mobil 375]** A számlalista továbbra is olvasható kártyalista; a kártya
    megkapta a fizetési határidőt és a státuszchipet, a kuka a `⋯` menübe került.
20. **[mobil 375]** A dashboard KPI-k egy oszlopban, a táblázat helyett
    kártyák; a „Következő lépések" itt is látszik.
21. **[mindkettő]** `npm run test:unit` zöld; új tesztek:
    `InvoiceListRow.test.tsx`, `InvoiceTimeline.test.tsx`,
    `InvoiceMoneyHeader.test.tsx`, `NextActionsCard.test.tsx`.
22. **[mindkettő]** Minden új sztring `hu` + `en`; a terminológia
    **Partnerek** (nem Ügyfelek) minden listában és fejlécben.

---

### Track D — `visual` (tokenek, megosztott layout/UI receptek, állapotok)

**Cél:** a „nem szép" panasz gyökere — és a **sharedFirst** alap, amire a
másik három track épít. Ez a track **először** szállítja az 5. fejezet
fájljait, egyetlen commitban, azután polírozza a részleteket.

**Érintendő fájlok**

- `lib/theme/layout.ts` (új)
- `lib/theme/tokens.ts` (`--border-subtle`, `--surface-raised`)
- `global.css` (ugyanezek + **Ranade `@font-face` javítása**)
- `tailwind.config.js` (`subtle` szín, rádiusz, `tabular-nums` segéd)
- `assets/fonts/ranade-500.woff2`, `ranade-700.woff2` (másolás a marketingből)
- `components/layout/PageHeader.tsx` (bővítés, visszafelé kompatibilisen)
- `components/layout/Section.tsx` (új)
- `components/layout/DataTable.tsx` (új, + `.web.tsx` ha DOM-ot renderel)
- `components/layout/FormField.tsx` (új)
- `components/layout/StateView.tsx` (új)
- `components/layout/StatCard.tsx` (bővítés)
- `components/layout/OverflowMenu.tsx` (új, + `.web.tsx`)
- `components/layout/DangerZone.tsx` (új)
- `components/layout/ScreenLayout.tsx` (`width` prop + max-szélesség)
- `components/layout/ListScreen.tsx` (angol hardcode empty title törlése,
  `StateView` használata)
- `components/layout/EmptyState.tsx` (a `StateView` köré vékonyítva vagy
  kivezetve — a meglévő hívások nem törhetnek el)
- `components/invoices/InvoiceStatusChip.tsx` (új)
- `lib/invoices/status-visuals.ts` (új) + teszt
- `components/ui/date-field/` (új, + `.web.tsx`)
- `components/ui/text/` (`numeric` prop, `.web.tsx` is)
- `components/ui/button/index.tsx` (a destruktív outline variáns osztályai —
  **csak osztályok, nem API-törés**)
- `lib/i18n/locales/hu.ts`, `en.ts` — **csak** `common.*`, `states.*`
- tesztek: `PageHeader.test.tsx`, `Section.test.tsx`, `DataTable.test.tsx`,
  `FormField.test.tsx`, `StateView.test.tsx`, `InvoiceStatusChip.test.tsx`,
  `status-visuals.test.ts`

**Nem nyúl hozzá:** `app/(app)/**` (egyetlen képernyő sem),
`components/navigation/**`, `components/invoices/**` (kivéve az új
`InvoiceStatusChip.tsx`), `components/dashboard/**`, `db/schema.ts`,
`lib/nav/**`, `lib/tax/**`.

**i18n kulcsok**

```
common.retry            "Újra"                    en "Retry"
common.search           "Keresés"                 en "Search"
common.moreActions      "További műveletek"       en "More actions"
common.required         "kötelező"                en "required"
common.collapse         "Összecsukás"             en "Collapse"
common.expand           "Kinyitás"                en "Expand"
states.loading          "Betöltés…"               en "Loading…"
states.emptyTitle       "Még nincs itt semmi"     en "Nothing here yet"
states.errorTitle       "Valami hiba történt"     en "Something went wrong"
states.errorDescription "Próbáld újra, vagy frissítsd az oldalt." / "Try again, or refresh the page."
```

**Elfogadási kritériumok**

1. **[sharedFirst]** Az 5. fejezet táblázatának **minden** fájlja létezik és
   exportálja a megadott típusokat; `npx tsc --noEmit` hibátlan.
2. **[sharedFirst]** `PageHeader`, `StatCard`, `ScreenLayout`, `ListScreen`
   **meglévő propjai** változatlanul működnek — a jelenlegi hívások
   módosítás nélkül fordulnak. Teszt: a régi prop-alakú render is zöld.
3. **[desktop 1440]** `ScreenLayout` alapértelmezésben `max-w-[1200px]`-be
   zárja a tartalmat, és középre igazítja. Teszt: a renderelt className
   tartalmazza a `max-w-[1200px] mx-auto`-t.
4. **[desktop 1440]** A Ranade betű ténylegesen betöltődik a dev szerveren:
   `document.fonts.check('500 16px Ranade') === true`. (E2E assert.)
5. **[desktop 1440]** `DataTable` renderel fejlécet, sorokat, jobbra zárt
   numerikus oszlopot `tabular-nums`-szal, rendezhető fejlécet és `⋯`
   sor-menüt; `loading` esetén skeleton sorokat, üres adatnál `StateView`-t.
6. **[desktop 1440]** `FormField` `required` esetén `*`-ot jelenít meg, és
   `error` esetén a hibaüzenetet **közvetlenül a mező alatt** rendereli,
   valamint destruktív keretet ad a gyermeknek.
7. **[desktop 1440]** `StateView` mindhárom `kind`-ja renderel; a `loading`
   skeleton, nem spinner; az `error` `onRetry` gombot ad.
8. **[desktop 1440]** `lib/invoices/status-visuals.ts`: **csak** a `paid`
   státusz térképez zöldre. Teszt: minden más státusz osztálysztringje nem
   tartalmazza a `green` szót és a `#15803d` hexet.
9. **[desktop 1440]** `components/layout/ListScreen.tsx`-ben nincs több
   `"Nothing here yet"` angol hardcode; az alapértelmezés i18n kulcs.
10. **[desktop 1440]** `border-subtle` token létezik `global.css`-ben,
    `tokens.ts`-ben és `tailwind.config.js`-ben, világos és sötét témában is.
11. **[desktop 1440]** `DateField` weben `<input type="date">`-et renderel
    (`.web.tsx`), natívon szöveges mezőt; `webDomProps` használatával, RN
    `style` tömb nélkül.
12. **[mobil 375]** `DataTable` mobil szélességen nem okoz vízszintes
    túlcsordulást: vagy `overflow-x` görgethető konténerbe kerül, vagy a hívó
    `renderMobile` fallbackjét használja (a komponens ezt támogassa).
13. **[mobil 375]** `PageHeader` 375 px-en egy oszlopba tördel; a cím nem
    csonkolódik, az elsődleges gomb teljes szélességű.
14. **[mindkettő]** `npm run test:unit` zöld; minden új komponensnek van
    render/interakció tesztje.
15. **[mindkettő]** Nincs RN `style={[…]}` tömb webre célzott ágon; a
    `.web.tsx` fájlok `webDomProps()`-ot használnak a rest propok
    szétterítése előtt (AGENTS.md §2).
16. **[mindkettő]** Minden új sztring `hu` + `en`.

---

## 7. Integrációs sorrend és ütközéskezelés

1. **`visual` merge-el először** a sharedFirst commitjával. A másik három
   track a megállapodott prop-alakra ír kódot, és nem várja meg — a merge
   után `git rebase` és a fordítás azonnal zöld kell legyen.
2. A négy track **diszjunkt fájlhalmazon** dolgozik; az egyetlen szándékolt
   metszet a két i18n locale fájl, ott is diszjunkt névterekkel (5. fejezet).
3. Merge sorrend javaslat: `visual` → `shell` → `lists` → `invoice-create`
   (a composer a legnagyobb felület, utoljára rebase-el).
4. Minden track saját `slice/*` ágon, saját worktree-ben; a Ship fázis merge-el.

## 8. Kifejezetten kívül maradó tételek (átadva, nem ebben a workflowban)

- A kimenő HTML/PDF bizonylat magyarítása és márkázása (INV-10, B1, B2) —
  kimenő dokumentumot érint, külön queue-item.
- `/settings/reminders` hiányzó `reminders.*` névtere (I18N-1) és az
  e-mail sablonok (T1–T4) — külön i18n/beállítás item.
- A pénznem-összeadás helyessége (`stats.monthlyTotal`, dashboard bevétel) —
  tax/pénzügyi következmény, számoló logika felülvizsgálata.
- Mennyiségi egység **kötelezősége** az Áfa tv. 169. § szerint (INV-6) —
  adó-tulajdonosi megerősítés. A UI opcionálisként szállítja.
- Kiküldött / NAV-hoz beküldött számla szerkeszthetősége (E4) — a kód ma
  már read-only ágat használ finalizált számlára; a NAV-viselkedés nem
  módosul ebben a workflowban.
- A partner-adatmodell bővítése irányítószámmal/országgal (C2) —
  `db/schema.ts` érintett, külön item.
- `selectable` prop React-figyelmeztetés (V10) — külön hibajavítás.
