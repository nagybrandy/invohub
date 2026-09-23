# Számlakészítés — UX/UI audit, 2026-09-23

**Módszer:** az éles deploy (`https://invohub.vercel.app`) végigjátszása valódi
bejelentkezéssel (E2E teszt-fiók), Playwrighttal, két nézetben — desktop
1440×900 és mobil 375×812. Útvonal: belépés → composer → partner → tételek →
ellenőrzés → piszkozat mentése (kétszer is, duplikáció-ellenőrzéshez).

A **véglegesítés** lépést nem játszottam végig: éles adatbázisba ír és
sorszámot éget el.

## Ami bizonyítottan működik

| Terület | Eredmény |
|---|---|
| Belépés → composer | 2,1–3,3 s, hibamentes |
| Konzolhibák / 4xx–5xx válaszok | 0 mindkét nézetben |
| Vízszintes túlcsordulás | 0 px mindkét nézetben |
| Partnerkereső | „Legutóbb számlázva" lista fókuszra, név/adószám keresés, `+ Új partner` inline (nem navigál el) |
| Tételek | ÁFA-kategóriák (Adóköteles / AAM / speciális adózás), termékkatalógus, egység |
| Összegek | 10 × 25 000 → nettó 250 000 / bruttó 317 500 Ft, azonnal frissül |
| Piszkozat mentése | `201 POST /api/invoices`; kétszeri mentés **nem** duplikál (a második `PATCH`) |
| PDF előnézet API | `200 POST /api/invoices/preview/pdf` |
| Interakciószám egy kész számláig | 8 (partner + 1 tétel), mindkét nézetben |

## Megállapítások

### Javítva ebben a változtatásban

1. **(MAGAS) Üres kötelező partnerrel is továbblépett a „Tovább".** Nem volt
   hibaüzenet; a hiányt a felhasználó csak véglegesítéskor tudta meg.
   → `validateComposerStep()` + `goToNextStep()`: a lépés elhagyása előtt
   validál, hibát jelez és a hibás mezőre fókuszál.

2. **(MAGAS) Mobilon az ellenőrzés lépésből nem lehetett piszkozatot menteni.**
   Az alsó sávban ott már csak „Vissza + Véglegesítés" volt.
   → a vissza 44×44-es ikongombra vált, mellette „Piszkozat mentése" és
   „Véglegesítés" — mindhárom elfér 375 px-en.

3. **(MAGAS) A NAV-beküldés alapból ki volt kapcsolva**, kódba égetve, nem a
   cégbeállításból. Magyar EV-nél az adatszolgáltatás kötelező, így minden
   számlánál a felhasználó emlékezetén múlt. A kapcsoló melletti szöveg
   ráadásul automatizmust ígért („automatikusan beküldésre kerül").
   → `isNavConfigured()`: ha a cégnek van teljes NAV-hitelesítése, a kapcsoló
   alapból bekapcsolt; a szöveg mostantól „Kiállításkor beküldjük a NAV
   Online Számla rendszerébe."

4. **(KÖZEPES) A „Véglegesítés" nem véglegesített egy kattintásra** — menüt
   nyitott, amely rátakart a bizonylattípus fülekre.
   → valódi split gomb: a felirat azonnal véglegesít, a chevron alatt marad a
   „Véglegesítés és küldés".

5. **(KÖZEPES, a11y) A kapcsolók nem közölték az állapotukat.** `aria-checked`
   hiányzott, tehát képernyőolvasóval nem derült ki, be van-e kapcsolva a
   NAV-beküldés. A kapcsoló érintőfelülete 40×22 volt.
   → explicit `aria-checked` + 44×44-es érintőfelület a 40×22-es kapcsoló
   körül (minden kapcsolóra a teljes appban).

6. **(ALACSONY) Címke-inkonzisztencia:** láthatóan „Bizonylat elküldése
   e-mailben", akadálymentesítési néven „Bizonylat postázása e-mailben".
   → egységesítve.

### Nyitva maradt

7. **(KÖZEPES) Desktopon elpazarolt képernyő.** 1440×900-on az 1. lépés a
   magasság ~15%-át használja. A 3 lépcsős varázsló egy oldalon is elférne —
   ezt a `slice/ux-one-page-composer` ág célozza (félbehagyva).

8. ~~**Az előnézet panel nem néz ki semmit.**~~ **VISSZAVONVA.** A panel
   valódi böngészőben kirajzolja a PDF-et. A `browserCanEmbedPdf()`
   (`InvoicePdfPreview.tsx:30`) a `navigator.pdfViewerEnabled` értékét nézi,
   ami a régi headless Chromium shellben `false`, valódi Chrome-ban `true` —
   az auditot futtató böngésző műterméke volt, nem hiba. Nem nyúltam hozzá.

9. **(KÖZEPES) Mobilon a fejlécek elviszik a képernyő ~58%-át.** A 812 px-ből
   ~470 px fejléc + értesítési sáv + morzsamenü + cím + bizonylattípus fülek +
   kétsoros stepper + a stepperrel duplikált „2/3 · Tételek" felirat.

10. **(ALACSONY) 44 px alatti érintési célpontok mobilon:** „Szerkesztés"
    linkek 80×20, alsó tabsáv ikonjai 38×38, értesítési sáv 313×20,
    nyelvváltó 38×44, bezárás 22×22.

11. **(ALACSONY) A partnertalálati sorok sima `div`-ek**, `role="option"` /
    `listbox` szemantika nélkül (csak `tabindex=0`).

12. **Nem tesztelt:** véglegesítés → sorszám → PDF → NAV → e-mail lánc.

## A javítások ellenőrzése

Helyben futó buildben (Expo web, valódi bejelentkezés), Playwrighttal,
mindkét nézetben — 10/10 ellenőrzés rendben:

- üres partnerrel nem lép tovább, megjelenik az „Az ügyfél neve kötelező."
- a „Véglegesítés" önálló elsődleges gomb (92×44)
- mindkét kapcsoló `aria-checked`-et közöl, 44×44-es felülettel
- a NAV-szöveg már nem ígér automatizmust
- mobilon az alsó sáv: `‹` (44×44) + „Piszkozat mentése" + „Véglegesítés"
- 0 konzolhiba

Unit: 264 suite / 1938 teszt zöld, `tsc --noEmit` tiszta.

---

# Második kör — 2026-09-23 délután

A fenti nyitott tételek elvégzése közben az **éles lánc mérése** két olyan
hibát hozott elő, amit statikus olvasással nem lehetett látni.

## Javítva a második körben

- **Egyoldalas composer desktopon.** 1440×900-on egy lépés helyett a partner,
  a tételek és a kiküldés egyszerre látszik; az ellenőrzés lépés ott elhagyja a
  read-only összegző kártyáit (a szekciók fölötte szerkeszthetők). Mobilon
  marad a varázsló.
- **Mobil fejléc.** Az első mező **y=497 → y=305** (a képernyő 61%-áról 38%-ára
  csökkent a fejléc). Elhagyva: morzsamenü (a fejléc és a tabsáv ugyanazt
  mondja), a stepperrel duplikált „2/3 · Tételek" felirat, a külön sorban álló
  „Előnézet" gomb (beköltözött a stepper sorába), és a stepper már csak az
  aktuális lépést írja ki, így egy sorban elfér.
- **Partnertalálatok szemantikája.** `combobox` + `listbox`/`option`,
  `aria-expanded`, soronként 44 px-es célpont.
- **Érintési célpontok.** Alsó tabsáv 38×38 → 73×48 (és a felirat is
  kattintható lett, eddig nem volt), szekció-„Szerkesztés" linkek és a
  nyelvváltó 44 px-re nőtt. Az értesítési sáv szándékos 40 px-es magassága
  marad, de a bezárás gombja 22×22 → 40×40.

## Az éles mérés eredménye (INV-2026-00002)

| Lépés | Eredmény |
|---|---|
| Véglegesítés | ✅ sorszám kiosztva, státusz „Fizetetlen", a felhasználó a számla adatlapján landol |
| PDF | ✅ 14 005 bájt, valódi `%PDF-` |
| NAV | ⚠️ `Nincs beküldve` — a cég NAV-beállítása hiányos (lásd lent) |
| E-mail | ❌ **nem ment ki**, pedig a kapcsoló be volt kapcsolva |

### Új hiba: a küldés két feltételhez volt kötve

`shouldSendOnAction()` csak a „Véglegesítés és küldés" műveletnél adott
`true`-t, és a hívó ezt még `&& emailOnSend`-del is szűkítette. Emiatt:

- a **„Véglegesítés és küldés" sem küldött semmit**, ha a kapcsoló ki volt
  kapcsolva — márpedig az az alapértelmezés;
- a kapcsoló bekapcsolása sima „Véglegesítés" mellett szintén nem küldött.

Javítva: a művelet *vagy* a kapcsoló elég; piszkozat továbbra sem megy ki.

### Üzemeltetési lelet: hiányzó adatbázis-migrációk

Az éles adatbázisból hiányzik a **0008** és a **0009** migráció
(`client.party_type`, `invoice.fulfillment_date`, `user.closed_at`,
`user.retention_until`). A most mergelt main ezekre az oszlopokra épít — a
bejelentkezés is elszáll nélkülük (`column "closed_at" does not exist`).
**A következő éles deploy előtt le kell futtatni a `npm run db:push`-t.**
A jelenlegi production ettől még működik: a #40 óta nincs automatikus deploy.

### A cég NAV-beállítása hiányos

`navEnvironment: "test"`, technikai felhasználó, jelszó és aláírókulcs
megvan, de a **csere kulcs (`navXmlChangeKey`) hiányzik**, így valódi
beküldés nem jön létre. A #31 óta a beküldés szerver oldalon automatikus, a
composer kapcsolója helyett tájékoztató szöveg áll — ezt a #31 már megoldotta,
az én korábbi kapcsoló-alapérték javításom emiatt tárgytalanná vált, kivettem.
