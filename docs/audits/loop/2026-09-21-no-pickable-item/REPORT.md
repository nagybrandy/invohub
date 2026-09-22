# Ship report — invoice-fulfillment-date-persist-nav

- **Dátum:** 2026-09-21
- **Backlog tétel:** Fázis 1 (Alap számlázás, NAV-kompatibilis), "Research
  refill 2026-09-21" szakasz — "Teljesítés dátuma is not a real field — NAV
  gets the issue date instead". A tervezési kör ezt a tételt választotta a
  "nincs kiválasztható tétel" eredmény helyett: ez a Research refill
  legmagasabb felhasználói értékű, valódi korrektségi hibája, és
  előfeltétele az ugyanabban a listában szereplő AAM/KATA bevételi keret
  tételnek.
- **Terv:** `docs/plans/2026-09-21-invoice-fulfillment-date-persist-nav.md`
- **Branch:** `slice/invoice-fulfillment-date-persist-nav`
- **PR:** https://github.com/nagybrandy/invohub/pull/26 (nyitva, emberi
  jóváhagyásra vár — **nincs mergelve, nincs deployolva**)

## Mi készült el

A komponáló képernyő eddig is megjelenítette a teljesítés dátuma mezőt, de
az sehova nem került el: `composeInvoiceNotes`
(`lib/invoices/client-form-fields.ts`) már senki nem hívta produkciós
kódútvonalon, nem volt sem `fulfillment_date` oszlop (`db/schema.ts`), sem
`Invoice.fulfillmentDate` mező, ezért a `lib/nav/invoice-xml.ts` mindig a
kiállítás dátumát küldte NAV felé `<invoiceDeliveryDate>` néven — minden
eddig beküldött számlánál. A teljesítés dátuma kötelező Áfa tv. 169. §
mező, és ez alapján mérik az alanyi adómentesség (AAM) értékhatárt is;
utólag számlázó EV-knél a korábban beküldött adat a hibás irányba tolja el
a bevételt a helytelen áfa-időszakba.

A szelet ezt zárja le:

- Additív `fulfillment_date` oszlop az `invoice` táblán (nullable, nincs
  default, nincs index — `drizzle/0005_invoice-fulfillment-date-persist-nav.sql`,
  kizárólag `ADD COLUMN`).
- `Invoice.fulfillmentDate` domain mező +
  `lib/invoices/fulfillment-date.ts` (`resolveFulfillmentDate`,
  `parseFulfillmentDateFromNotes`, `normalizeFulfillmentDateInput`), olvasás
  idejű fallback a régi soroknak, amelyeknél a dátum csak a `notes`
  `Teljesítés: …` sorában élt — az oszlop mindig felülírja a notes-értéket.
- `lib/nav/invoice-xml.ts`: a `<invoiceDeliveryDate>` precedencia mostantól
  `invoiceDeliveryDate ?? fulfillmentDate ?? issueDate` (a meglévő
  `NavInvoiceExtra` override és a nem-értelmezhető dátum fallback
  változatlan).
- PDF (`generate-pdf.ts`) és HTML előnézet (`preview-html.ts`): "Teljesítés
  kelte" meta-szegmens a kiállítás kelte és a fizetési határidő között,
  csak akkor, ha van feloldott érték.
- Komponáló (`useInvoiceComposer.ts`, `StepPartner.tsx`) menti és
  visszatölti a mezőt; `composeInvoiceNotes` már nem írja duplán a
  `notes`-ba.
- `POST /api/invoices`, `PATCH /api/invoices/[id]` és
  `createInvoiceFromPayload` validálja/normalizálja.
- `duplicateInvoice` / `createStornoInvoice` / `createModificationDraft` /
  díjbekérő→számla konverzió átviszi (regressziós védelem, már eddig is
  `...source`-ot terjesztettek).
- Új i18n kulcsok `hu.ts`-ben és `en.ts`-ben egyaránt.

## Tesztek

- Új: `lib/invoices/fulfillment-date.test.ts`. Bővítve:
  `lib/invoices/mappers.test.ts`, `lib/nav/invoice-xml.test.ts`,
  `lib/invoices/preview-html.test.ts`, `lib/invoices/generate-pdf.test.ts`,
  `lib/invoices/create-from-payload.test.ts`,
  `lib/invoices/client-form-fields.test.ts`,
  `lib/invoices/service.test.ts`,
  `components/invoices/composer/useInvoiceComposer.test.tsx` — a terv
  AC1-AC14 mindegyikét lefedve.
- `npx tsc --noEmit` — tiszta (ship-fázisban újra ellenőrizve).
- `npm run test:unit` — **228 suite / 1562 teszt, mind zöld**, nincs
  regresszió (ship-fázisban a `slice/` branch-en újrafuttatva).

## Findings

- **Alacsony súlyosságú, javításra vár** (rögzítve a `docs/loop-queue.md`
  Fázis 1 szakaszában, `- [ ]` follow-up tételként): a teljesítés-dátum
  súgószövege (`StepPartner.tsx` 229-231. sor) feltétel nélkül jelenik meg
  az első `VStack`-ben, és tipikus desktop szélességnél (~220-240px oszlop
  a 720px-re korlátozott form-oszlopban) több sorba törhet, míg a másik két
  dátum-oszlop nem nő — emiatt egyenetlen a háromoszlopos sor magassága. A
  terv (§7, "UX notes") pontosan erre az esetre adott feltételes
  fallback-et (a súgó kerüljön a `HStack` alá, ha kitolná a fizetési
  határidő gyorsválasztó pill-eket), ezt a kész kód nem implementálja.
  A fixer eredeti "medium" besorolását a ship-review "low"-ra vitte le: a
  szekció egy `ScrollView`-ban van (`InvoiceComposer.tsx` 174, 207. sor),
  így a plusz sormagasság csak a görgetési hosszt növeli, a pill-ek
  elérhetők maradnak, és a terv 14 elfogadási kritériuma közül egyik sem
  érinti ezt a viselkedést. Kizárólag kozmetikai — a terv saját fallback
  útmutatása szerint opcionálisan javítható, de nem blokkoló.
- Elhalasztott találat a fixertől: **nincs**.
- A terv §9 ("Out of scope") saját maga sorol fel jövőbeli follow-up
  tételeket — sor-tétel `unit` mezőjének perzisztálása, a NAV 2026-01-01
  validációs szabálykészlet, az AAM/KATA bevételi keret mérő, a régi sorok
  notes-alapú visszatöltése — ezek nem ebben a körben kapott új findingek,
  hanem korábban is dokumentált, nem ebben a szeletben elvégzendő
  feladatok.

## Gated — miért nincs automatikus merge/deploy

Ez a szelet megváltoztatja, mit küld InvoHub a NAV Online Számla kötelező
`<invoiceDeliveryDate>` mezőjébe, és hozzáad egy kötelező Áfa tv. 169. §
mezőt a nyomtatott bizonylathoz. A `CLAUDE.md` szerint a `lib/nav/`
produkciós viselkedést érintő és adó/jogi vonatkozású módosítások emberi
jóváhagyáshoz kötöttek. Ezért:

- **Nincs merge** — a PR emberi jóváhagyásra vár.
- **Nincs deploy**, nincs `db:push` — az additív `fulfillment_date` oszlop
  a PR jóváhagyása/merge-e után kerülhet ki a Ship-fázis `db:push`
  lépésével.
- NAV production endpoint nem lett hívva; a szelet maga nem hív NAV
  végpontot, a meglévő hívási útvonalak `test`/`demo` módban maradnak,
  nem lett kitalálva vagy commitolva hitelesítő adat.
- `docs/loop-queue.md` érintett tétele `[~] needs sign-off (PR)`-ra
  állítva (a Research refill szakasz részletes bejegyzésén).

**Green:** igen (`tsc` + `test:unit` zöld). **Gated:** igen (tax/legal/NAV)
— a "green" ellenére ez a kombináció itt PR-t jelent auto-merge helyett,
a CLAUDE.md workflow-szabálya szerint.

## Deploy URL / PR URL

- **PR:** https://github.com/nagybrandy/invohub/pull/26
- Deploy: nincs (gated tétel, nem shippelt production-be).

## Következő javasolt tétel

Jelenleg **három másik, szintén tax/legal/NAV-gated PR** vár emberi
jóváhagyásra a sorban: `slice/retro-correct-non-huf-invoices-nav-modify`
(#25), `slice/e-nyugta-nav-receipt-api` (#17) és
`slice/receipt-blocked-message-i18n-fallback` (#19) — ezek jóváhagyása
segítene a queue-nak ténylegesen haladni, mivel a Fázis 1 lista teteje már
jórészt gated tételekből áll.

Ha a dev-loop egy **nem gated**, azonnal auto-mergelhető tételt keres
legközelebb, a fázis-sorrend szerinti következő ilyen a Fázis 2 lista első
pipálatlan eleme: **"Bank statement import: CSV and camt.053 parsing"**
(`lib/import/`) — ez a CLAUDE.md szerint is kötelezően megelőzi bármilyen
élő bank/PSD2 kapcsolatot, nem érint `lib/tax/`-ot, `lib/nav/` produkciós
viselkedést vagy marketing szöveget, és a Fázis 1 gated torlódástól
függetlenül elindítható.

Ha inkább a jelen tételhez kapcsolódó munkát folytatnánk: a terv §9-ben és
a Research refill bejegyzésben is jelzett **AAM/KATA bevételi keret mérő**
a logikus következő lépés, de az explicit módon *ettől a PR-től függ* —
csak azután indítható, hogy ez mergelve lett (a keret méréséhez a valódi
teljesítés dátumra van szükség).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
