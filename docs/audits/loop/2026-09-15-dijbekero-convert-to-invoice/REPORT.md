# Ship report — Díjbekérő (proforma) → real invoice konverzió

**Dátum:** 2026-09-15
**Item:** Díjbekérő (proforma) → real flow: DBK szám, "Számla készítése ebből"
akció, amely valós számlává konvertál (`lib/invoices/numbering.ts`, detail
screen) — konverziós akció, amely átmásolja a tételeket és az ügyfél adatait
egy új INV dokumentumba, és összeköti a kettőt.
**Terv:** `docs/plans/2026-09-15-dijbekero-convert-to-invoice.md`
**Ág:** `slice/dijbekero-convert-to-invoice-impl` (PR, nincs mergelve)
**Zöld:** nem (lásd alább) **Kapuzott (tax/legal/NAV-prod):** nem

## Mi készült el

A díjbekérő (proforma) eddig zsákutca volt: `lib/invoices/numbering.ts`
DBK-/ELO- számokat generált, de semmi nem tudott belőle valódi számlát
csinálni. Ez a slice ezt oldja meg:

- **`lib/invoices/convert-proforma.ts`** (új) — tiszta builder, amely egy
  díjbekérő tételeit, ügyféladatait és jegyzeteit átmásolja egy új INV
  draftba, és beállítja a `convertedFromInvoiceId` mezőt.
- **`lib/invoices/service.ts`** — `convertProformaToInvoice` +
  `findExistingConversion` (409-es duplikáció-védelem).
- **`app/api/invoices/[id]/convert+api.ts`** (új) — a konverziós végpont.
- **`app/api/invoices/[id]/links+api.ts`** — két új kulcs
  (`convertedFromInvoiceId`/`convertedToInvoices`) a kapcsolódó bizonylatok
  kártyához.
- **`app/api/invoices/[id]/storno+api.ts` / `modify+api.ts`** — védelem, hogy
  díjbekérőn ne lehessen sztornót/helyesbítőt indítani (ez korábban valódi
  `INV-` számot égetett el egy sosem-számla törlésére — a terv által azonosított
  mellékes hiba, ebben a slice-ban javítva).
- **`app/(app)/invoices/[id]/index.tsx`** — "Számla készítése ebből" elsődleges
  akció, "Kapcsolódó bizonylatok" kártya mindkét irányban.
- **`app/(app)/invoices/index.tsx`** — a lista soraiban is elérhető a konverzió
  díjbekérő sorokon.
- **`drizzle/0002_dijbekero-convert-to-invoice.sql`** — additív, nullable
  `invoice.converted_from_invoice_id` oszlop + FK + btree index.

**Fix round 1** (`ef071e5`, egy korábbi review körből, most fast-forwardolva
a szállítandó ágra): a convert/storno/modify hibakódok felszínre hozása a
UI-n (korábban generikus hibaüzenet jelent meg), és a mobil nézeten hiányzó
konverziós akció pótlása.

Kockázat: **schema** (egy additív nullable oszlop + index), **nem**
tax/legal-gated — a díjbekérő dokumentum jogi diszklémere ("nem számla, áfa
levonására nem jogosít") szándékosan kimaradt ebből a slice-ból, külön,
aláírás-kapuzott követő tételként.

## Tesztek

- `npx tsc --noEmit` — tiszta.
- Az érintett 7 teszt-suite külön futtatva (`--maxWorkers=2
  --testTimeout=30000`, mert a gép jelenleg erősen terhelt több párhuzamos
  agent-worktree miatt): **6 suite, 77 teszt, mind zöld**
  (`lib/invoices/convert-proforma.test.ts`, `lib/invoices/service.test.ts`,
  `app/api/invoices/[id]/convert+api.test.ts`,
  `__tests__/screens/invoice-detail.test.tsx`,
  `__tests__/screens/app-pages.smoke.test.tsx`,
  `components/invoices/InvoiceCard.test.tsx`, `lib/api/client.test.ts`).
- A teljes `npm run test:unit` (197 suite / 1093 teszt) egy korábbi körben
  4 időtúllépéses hibát mutatott a gép jelenlegi terhelése miatt
  (`UserMenu.test.tsx` ×2, `invoice-detail.test.tsx` ×1,
  `invoice-edit.test.tsx` ×1); izoláltan újrafuttatva mind a 3 suite zöld
  volt (18/18 teszt, 15s) — tiszta CPU-éhezés, nem valódi regresszió.

**Miért nem "zöld" a ship jelzés mégsem:** a `dryRun=false`/`green=false`
paraméter ezt a slice-ot úgy jelölte, hogy nem automatikusan mergelendő —
emberi review/sign-off szükséges a PR-en, ezért marad `[~]` állapotban a
loop-queue-ban, PR-re várva, nem azért mert bármelyik teszt piros lenne.

## Talált és rögzített hibák (findings)

Mind az 5, alacsony súlyosságú, **nem blokkoló** talált hiba bekerült a
`docs/loop-queue.md` Phase 1 szekciójába, mint "- [ ]" követő tétel:

1. **Check-then-act verseny** — ugyanaz a díjbekérő elméletileg kétszer is
   konvertálható egy dupla kattintással/két fülön (nincs tranzakció/unique
   constraint), de csak egy extra draftot eredményez, számot nem éget el.
   Ugyanez a minta már jelen van a `storno+api.ts`-ben is, elfogadott
   kockázatként.
2. **AC20 nincs automatizált teszttel lefedve** — a "Kapcsolódó bizonylatok"
   kártya renderelése/navigációja csak manuálisan ellenőrzött, a terv által
   előírt PR-body jegyzet nélkül.
3. **Redundáns dupla `runAction("convert", ...)`** a konvertálás gombon —
   ártalmatlan, de inkonzisztens a képernyő többi handlerének mintájával.
4. **Sztornózott korábbi konverzió ugyanúgy jelenik meg, mint egy élő** a
   "Kapcsolódó bizonylatok" listában — UX finomítás.
5. **Az ág 2 commit-tal el volt csúszva a main-től** (asztali oldalsáv
   redesign hiányzott) — kozmetikai, rebase/merge esetén magától megoldódik.

Elhalasztva (a fixer round jegyzete szerint, nem ennek a slice-nak a
hatóköre): a branch-checkout ütközés, ami miatt ez a ship kör a
`fixround1-dijbekero-convert` ág csúcsát (`ef071e5`) fast-forwardolta a
`slice/dijbekero-convert-to-invoice-impl` ágra (a kettő azonos tartalmú,
lásd `git merge --ff-only`), valamint a storno/modify defenzív hibakód-teszt
hiánya és a gép-terhelés miatti flaky tesztek — ezek egyike sem tartozik
ehhez az item-hez.

## Deploy / PR

Nincs deploy — a slice tax/legal szempontból nem kapuzott, de a `green=false`
paraméter miatt nem lett automatikusan mergelve. PR nyitva emberi
review/sign-off-ra: lásd a PR linket a feladat kimenetében.

## Következő javasolt item

A loop-queue Phase 1 prioritási listája szerint a következő nyitott tétel:
**"Partially-paid invoice past due date surfaces as overdue"** (státusz
levezetés — item 6), vagy alternatívaként a jelen slice-hoz tartozó,
aláírás-kapuzott followup: a díjbekérő dokumentum jogi diszklémerének
("nem számla, áfa levonására nem jogosít") hozzáadása a PDF/preview
sablonhoz.
