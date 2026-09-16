# Ship report — pdf-invohub-brand-mark

**Dátum:** 2026-09-16
**Tétel:** "No real InvoHub brand mark anywhere in the PDF" — a PDF-számla
lábléce eddig sehol nem mutatta a valódi InvoHub márkajelet, csak a kiállító
cég saját logóját vagy egy egyszerű monogram-jelvényt; a HTML előnézetben már
megvolt a "Készült az InvoHub-bal · invohub.hu" szöveges lábléc, a PDF-ből ez
teljesen hiányzott.
**Terv:** `docs/plans/2026-09-16-pdf-invohub-brand-mark.md`
**Branch:** `slice/pdf-invohub-brand-mark` (HEAD: `30d3e05`, implementáció:
`275eafc`)

## Eredmény: a ship folyamat megszakítva — a fő checkout nem volt tiszta

A ship-lépések előírt első ellenőrzése (`git status --porcelain` a fő
checkoutban, `.claude/worktrees`-en kívül tisztának kell lennie) **elbukott**:

```
 M marketing/assets/site.css
 M marketing/index.html
?? docs/audits/loop/2026-09-16-pdf-invohub-brand-mark/   (a jelen audit könyvtár, screenshotok)
```

A `marketing/assets/site.css` és a `marketing/index.html` módosításai **nem
ehhez a tételhez tartoznak** — egy másik, nem commitolt munka (a landing page
hero/tile "brand mark" vízjel-elhelyezéseinek további finomítása), ami
közvetlenül a fő checkout munkafájljaiban ül, commit nélkül. Ez ütközik a
CLAUDE.md workflow-szabályával ("Only implementer ... write code, and only on
their own slice/* branch"), és a ship-instrukció kifejezetten úgy szól, hogy
ilyen esetben **meg kell szakítani és jelenteni, miért** — nem szabad a
tétel branch-jét egy piszkos main-nel összefésülni, mert az véletlenül
becsomagolná ezt az idegen, nem felülvizsgált változtatást is a merge-be.

**Ezért ezen a körön:**
- **nem történt** `git checkout main && git merge` — a `slice/pdf-invohub-
  brand-mark` **nincs mergelve** a `main`-be
- **nem történt** `git push origin main`
- **nem történt** `vercel --prod` — nincs új deploy URL
- **nem történt** smoke test (nem volt új production deploy, amit tesztelni
  kellett volna)

A slice branch-en ugyanakkor elvégeztem, ami a fő checkouttól függetlenül,
biztonságosan elvégezhető volt:

- A két alacsony súlyosságú follow-up bejegyzést hozzáfűztem a
  `docs/loop-queue.md`-hez (Phase 1 vége, a `dijbekero-convert-to-invoice`
  blokk review-elemei után) — commit `30d3e05` a `slice/pdf-invohub-brand-
  mark` branch-en.
- Futtattam `npx tsc --noEmit`-et és `npm run test:unit`-et **a slice branch
  HEAD-jén** (nem a main+merge állapoton, mivel a merge nem történt meg):
  mindkettő **zöld** — `202 suites / 1155 tests`, 0 hiba. Ez megerősíti, hogy
  maga a tétel implementációja kész és tesztekkel fedett; a blokkoló kizárólag
  a fő checkout állapota, nem a slice minősége.
- Ezt a jelentést és a hozzá tartozó screenshotokat (a build/tesztelés során
  a fő checkoutban keletkezett, oda még nem commitolt PNG-ket) átmásoltam és
  commitoltam a slice branch-re, hogy ne vesszenek el.

## Talált findingok (alacsony súlyosságú, nem blokkolók)

1. **Elavult alapról vágott branch** (`acceptance`) — a branch a mostani
   `main`-hez képest 2 commit-tal régebbi állapotból lett elindítva
   (`git merge-base main slice/pdf-invohub-brand-mark` == `958bd89`, a
   `main` HEAD-je `7f82812`). Közvetlenül ellenőrizve: a three-dot diff a
   merge-base-hez képest pontosan a terv 12 fájlját érinti, a zajos
   `main..slice` two-dot diff (6 ikon PNG, `LandingSections.tsx`, egy törölt
   terv-dokumentum) tisztán a régi alap műterméke. `git merge-tree` nulla
   konfliktust adott — egy normál merge/rebase konfliktusmentesen
   alkalmazható, nem írná felül az ikon- vagy terv-dokumentum-commitokat.
   Kódjavítás nem szükséges.
2. **A lábléc attribúciós szövege alacsony kontrasztú marad** (`ux`) — a
   `lib/invoices/preview-html.ts` `.footer` szabálya (`color: #8a90a6;
   font-size: 0.78rem`) változatlan ebben a slice-ban; a számított kontraszt
   fehér alapon ≈3.17:1, a WCAG AA 4.5:1 küszöbe alatt. Vizuálisan
   megerősítve a `screens/desktop-ux-preview-with-company-footer.png`
   képen — maga a márkajel jól látható, csak a kísérő szöveg halvány. Nem
   blokkoló, opcionális csiszolás egy jövőbeli érintéskor.

Mindkettő felkerült a `docs/loop-queue.md`-be `- [ ]` tételként, a Phase 1
szekció végén, `(2026-09-16 ship review of slice/pdf-invohub-brand-mark, ...)`
címkével.

## Következő lépés (nem automatizálható innen)

A ship folytatásához valakinek (a tulajdonosnak vagy egy erre jogosult
agentnek) rendeznie kell a fő checkout `marketing/assets/site.css` /
`marketing/index.html` állapotát — vagy commitolja azt egy saját branch-re,
vagy eldobja, ha nem szándékos —, utána a `slice/pdf-invohub-brand-mark`
(HEAD `30d3e05`) újra megkísérelhető mergelésre/deployra a szokásos Ship
folyamattal. A tétel maga (typecheck + 202/1155 teszt zöld, nincs tax/legal/
NAV-production érintettség) készen áll az automatikus merge-re, amint a fő
checkout tiszta.

**Javasolt következő backlog-tétel, amint ez elhárul:** "Broken pagination
wastes an entire page" (Phase 1, ugyanabban a blokkban) — a
`pdf-invohub-brand-mark` slice megjegyzése szerint a láblécrajzolás javítása
mellékhatásként már megszüntethette az üres második oldalt
(`buildSamplePreviewInvoice()` 2 oldal → 1 oldal), de ezt még explicit
ellenőrizni kell egy ténylegesen 2 oldalt igénylő számlán.
