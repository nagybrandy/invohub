# Ship report — nav-xml-payment-method-date

- **Dátum:** 2026-09-15
- **Backlog tétel:** Fázis 1 (Alap számlázás, NAV-kompatibilis), tulajdonosi
  prioritás #4 — "Payment method + payment date into the NAV XML
  (`paymentMethod`, `paidAt`)"
- **Terv:** `docs/plans/2026-09-15-nav-xml-payment-method-date.md`
- **Branch:** `slice/nav-xml-payment-method-date`
- **PR:** https://github.com/nagybrandy/invohub/pull/14 (nyitva, emberi
  jóváhagyásra vár — **nincs mergelve, nincs deployolva**)

## Mi készült el

A NAV XML eddig egyáltalán nem tartalmazta a fizetési módot, és a tétel saját
szövege szerint a `paidAt` (tényleges fizetési dátum) is a `paymentDate`
mezőbe kellett volna kerüljön. A tervezés a publikált `invoiceData.xsd` /
`invoiceBase.xsd` (nav-gov-hu/Online-Invoice) ellenőrzésével kimutatta, hogy
ez a premissza **téves**: az `invoiceDetail/paymentDate` a séma szerint
"Fizetési határidő" (esedékesség), nem a tényleges fizetés dátuma, és az OSA
3.0-ban **nincs is mező** a tényleges fizetési dátumnak (sem
`ConventionalInvoiceInfoType`-ban, sem `AdditionalDataType`-ban). Ezért a
`paidAt` szándékosan **kimarad** az XML-ből — ezt a tervben és a PR leírásban
is rögzítettük, hogy egy jövőbeli agent ne "javítsa vissza".

Ami ténylegesen bekerült:

- `<paymentMethod>` elem (TRANSFER/CASH/CARD/OTHER), a séma szerint
  ellenőrzött pozícióban: `<exchangeRate>` és `<paymentDate>` között. Ha
  nincs rögzített fizetési mód, az elem kimarad (opcionális, `minOccurs="0"`),
  nem találunk ki `OTHER`-t a semmiből.
- `<paymentDate>` (= `invoice.dueDate`, a határidő) most már
  `InvoiceDateType`-kompatibilis alakban megy ki (`YYYY-MM-DD`, ≥
  2010-01-01) — korábban a nyers `text` oszlopot escapelte, ami időbélyeg
  esetén sémahibás riportot adott volna.
- `invoiceIssueDate` és `invoiceDeliveryDate` is ugyanígy normalizált, nyers
  string fallback-kel, hogy egyetlen ma működő számla se regresszáljon.
- Új tiszta modul: `lib/nav/invoice-fields.ts` (`toNavPaymentMethod`,
  `toNavDate`), fejlécben pontos XSD fájl/típus/sorszám hivatkozással — az
  `invoiceReference` munka mintáját követve.
- `lib/invoices/payment-status.ts`: `PAYMENT_METHODS`, `isPaymentMethod`.
- `POST /api/v1/invoices` (`lib/invoices/create-from-payload.ts`) mostantól
  fogad `paymentMethod`-ot, validálva.
- `docs/external-api.md`, `docs/nav-test-setup.md` frissítve.

## Tesztek

- `lib/nav/invoice-fields.test.ts` (új), `lib/nav/invoice-xml.test.ts`,
  `lib/invoices/payment-status.test.ts`,
  `lib/invoices/create-from-payload.test.ts` — a terv AC1-15 mindegyike zöld.
- `npx tsc --noEmit` — tiszta.
- `npm run test:unit` — **979/979 teszt zöld**, teljes csomag, nincs
  regresszió.

## Findings

- Alacsony súlyosságú talált hiba ebben a körben: **nincs** (a fixer által
  átadott lista üres).
- Elhalasztott találat: **nincs**.
- A terv §9 ("Out of scope") önmagában is felsorol jövőbeli
  follow-up-tételeket (pl. `POST /api/invoices` teljes body-validáció,
  `cashAccountingIndicator` és társai áttekintése, storno fizetési mód
  kérdése) — ezek nem ebben a körben kapott új findingek, hanem a terv saját,
  korábban is dokumentált nyitott kérdései (OQ-1…OQ-5 a PR leírásában).

## Gated — miért nincs automatikus merge/deploy

Ez a szelet a kötelező NAV Online Számla adatriport tartalmát változtatja
meg. A `CLAUDE.md` szerint a `lib/nav/` submission-viselkedés adó/jogi
jóváhagyáshoz kötött. Ezért:

- **Nincs merge** — a PR emberi jóváhagyásra vár.
- **Nincs deploy.**
- NAV production endpoint nem lett hívva; minden munka `demo`/`test` módban
  történt, nem lett kitalálva vagy commitolva hitelesítő adat.
- `docs/loop-queue.md` 4. tétele `[~] needs sign-off (PR)`-ra állítva
  (mindkét előfordulás: a fázis-1 listában és a részletes bejegyzésben).

Nyitott kérdések a PR leírásában (OQ-1…OQ-5): fizetési mód hiányában
kihagyás vs. `OTHER`; storno dokumentum fizetési módja; utólagos
fizetésimód-változás (MODIFY szükségessége); `paymentDate` készpénzes
számlán; és a `paidAt`-nak nincs OSA-helye finding megerősítése.

## Deploy URL / PR URL

- **PR:** https://github.com/nagybrandy/invohub/pull/14
- Deploy: nincs (gated tétel, nem shippelt production-be).

## Következő javasolt tétel

A `docs/loop-queue.md` Fázis 1 listáján a következő nyitott, nem gated vagy
kevésbé blokkolt tétel: **5. Díjbekérő (proforma) → real flow** (DBK szám,
"Számla készítése ebből" akció, ami átalakítja véglegessé) — ez jelenleg a
lista következő számozott (nem "folyamatban") tétele, és nem tax/legal
gated, tehát a ship-fázis auto-mergelhetné, ha zöld. Alternatívaként a két
másik, jelenleg is folyamatban lévő gated PR
(`slice/hungarianize-brand-invoice-preview-pdf`,
`slice/non-huf-invoice-exchange-rate-nav-xml`) emberi jóváhagyása szintén
soron következő, hogy a queue haladjon.
