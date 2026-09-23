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

8. **(KÖZEPES) Az előnézet panel nem néz ki semmit.** Desktopon a jobb oldali
   dobozban a „A PDF a készülék PDF-nézőjében nyílik meg." mobilos szöveg áll,
   közben munkamenetenként 4 `POST /api/invoices/preview/pdf` hívás fut le.

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
