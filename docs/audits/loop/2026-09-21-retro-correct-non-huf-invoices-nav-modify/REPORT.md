# Ship report — retro-correct-non-huf-invoices-nav-modify

**Dátum:** 2026-09-21
**Tétel:** Phase 1 — Core invoicing, NAV-compliant, `docs/loop-queue.md`
Prioritás lista 11. pontja. Retro-correct non-HUF invoices already reported
to NAV with the old hardcodolt `exchangeRate=1` — item 10
(`slice/backfill-non-huf-invoices-missing-exchange-rate`) csak felszínre
hozta a hiányzó árfolyamú számlákat; ez a tétel azokat a **már NAV-nak
beküldött** non-HUF számlákat célozza, amelyeknél a beküldött HUF áfa-alap
implicit 1-es árfolyamon lett számolva, tehát a NAV-nál lévő rekord ma
eltér a valóságtól.
**Terv:** `docs/plans/2026-09-21-retro-correct-non-huf-invoices-nav-modify.md`
(risk: **tax-legal** — `lib/nav/` production-viselkedés, állítás arról,
hogy egy már beadott adóbevallási rekord hibás, additív séma-változás,
NAV-beküldési szöveg).
**Branch:** `slice/retro-correct-non-huf-invoices-nav-modify` (build-commit
`904588d` + 1 fix kör `821b117`, a Ship a kettőt fast-forward-dal egyesítve
vitte tovább a branchen; PR fejcommitja `4e1e936`).
**Bemenő állapot:** Green: true, Gated (tax/legal/NAV-prod): true.

## Eredmény: PR nyitva, nincs merge/deploy

A bemenő állapot **gated: true**, ezért — a `CLAUDE.md`/`docs/loop-queue.md`
workflow-szabálya szerint ("Tax and legal items need explicit human
sign-off before merge... this includes anything under `lib/nav/` production
behaviour") — a Ship fázis nem mergelt a `main`-be és nem futtatott
`vercel --prod`-ot, függetlenül attól, hogy a build zöld volt. Helyette PR-t
nyitott emberi (adó-/jogi) review és jóváhagyás céljából:

**PR:** https://github.com/nagybrandy/invohub/pull/25

`docs/loop-queue.md` 11. pontja `[~] Built, not merged`-ről
`[~] needs sign-off (PR)`-re lett javítva.

## Mi shippelt (a PR-ban, mergelésre várva)

Csak a detektálás/mennyiségi számítás/magyarázat fele — **semmilyen új
kódútvonal nem küld NAV-jelentést** (AC6):

- `nav_submission` három nullable audit oszlopot kapott
  (`reported_currency`, `reported_exchange_rate`, `reported_vat_huf`);
  `submitOutgoingInvoiceToNav` mostantól minden *jövőbeli* beküldésnél
  rögzíti, mit jelentett ténylegesen (pénznem, `formatExchangeRate`-forma
  árfolyam, soronként majd összegzett HUF áfa), a `tokenExchange`/
  `manageInvoice` hívási argumentumok és a `NavSubmissionResult` alakja
  változatlan (AC1). A migráció (`drizzle/0004_nav_submission_reported_amounts.sql`)
  kizárólag három `ADD COLUMN` utasítás, nincs benne DROP/rename/NOT
  NULL/adatmódosító utasítás (AC7).
- `lib/nav/reported-rate.ts` (új, tiszta, I/O-mentes):
  `classifyNavExchangeRateReport(invoice, submissions)` — konzervatív
  konstrukció szerint: demo-only vagy nincs beküldés, HUF-számla, illetve
  storno/modify dokumentum mind `"none"`; egyező rögzített árfolyam `"ok"`;
  eltérő rögzített árfolyam `"misreported"` (`source: "recorded"`); egy
  `null` rögzített árfolyam a `NAV_EXCHANGE_RATE_FIX_AT` (az item-3 fix
  commit-pillanata, `7f926f7`) előtt `"misreported"` a ismert implicit
  1-es árfolyamon (`source: "legacyImplicitOne"`); ugyanez utána
  `"unknown"` — sosem tippel. A legutóbbi nem-demo beküldés
  (`submittedAt` szerint) dönt (AC2, 10/10 eset tesztelve).
  `computeNavHufMisreport` a besorolt eltérést jelentett/helyes/delta HUF
  nettó/áfa/bruttó összegekre bontja, soronként konvertálva majd
  összegezve — ugyanabban a sorrendben, mint a `buildNavInvoiceXml`, és
  olyan sorokon tesztelve, amelyek a két módon eltérően kerekednek, hogy a
  NAV kereszt-összeg-ellenőrzése ne regresszáljon (AC3). A fix kör ezen
  javított: a jelentett bruttó/áfa mostantól visszaolvasva a
  `nav_submission`-ból (nem újraszámolva), és a bruttó kerekítési hiba
  javítva.
- `GET /api/nav/status?invoiceId=…` mindig visszaad egy
  `exchangeRateReport` mezőt (a besorolás, `"misreported"` esetén HUF
  összegekkel bővítve); az auth guard, a 404-ek és a `submissions` payload
  változatlan; egyik teszt sem igényel élő Postgres-kapcsolatot (AC4).
- Új `NavExchangeRateAuditCard` (tisztán prezentációs) a számla-részletező
  képernyőn, a meglévő hiányzó-árfolyam kártya alatt, csak `kind:
  "misreported"` esetén: jelentett vs. jelenlegi árfolyam, jelentett vs.
  helyes HUF áfa, az app formázóin keresztül; a gombja a **már meglévő**
  `handleCorrection`-t futtatja (`POST /api/invoices/[id]/modify`, egy
  kérés, majd navigáció az új helyesbítő draft-ra — az EV maga nézi át és
  küldi be), vagy — ha nincs jelenlegi árfolyam összehasonlításhoz —
  `routes.invoiceEdit(id, { focus: "exchangeRate" })`-re navigál; elnyomva,
  ha a számlához már létezik korrekciós dokumentum; minden szöveg `t()`-n
  keresztül (AC5). A fix kör ezen javított: a CTA duplikációja megszűnt.
- Új `invoices.navExchangeRateAudit.*` i18n blokk (`hu.ts`/`en.ts`) —
  a terv szövegezési szabálya szerint átnézve: csak tények és számok,
  nincs határidő, nincs "kötelező", nincs Áfa tv. paragrafus-hivatkozás,
  nincs bírság-állítás, nincs tanácsadás.
- `lib/tax/`, `lib/m2m/`, `marketing/` érintetlen; `lib/nav/environment.ts`
  és a NAV mód-alapértelmezések változatlanok; nincs `production`
  hivatkozás.

A "retro-correct" auto-MODIFY-beküldés fele (hogy az app saját
kezdeményezésre tényleges NAV-korrekciót adjon be) **véglegesen kimarad**
ebből a tételből (terv §9.1) — az EV és a könyvelője dönti el,
mikor/hogyan adja be a helyesbítést; az InvoHub csak a draft-ot készíti
elő.

## Tesztek

- `npx tsc --noEmit` (a PR fejcommitján, `4e1e936`, a Ship worktree-jában)
  — **zöld**.
- `npm run test:unit` (ugyanott) — **224 suite / 1502 teszt, mind zöld**
  (a build 1497 tesztjéhez képest a fix kör 5 új tesztet adott:
  `lib/nav/reported-rate.test.ts` bővítése + `/api/nav/status`
  exchange-rate-report teszt).
- A terv mind a 7 elfogadási kritériuma teljesül (terv §-hivatkozásokkal
  fent).
- `db/schema.ts` változása additív-only; nem futott `db:push` (a Ship csak
  additív, zöld, nem-gated tételeknél pushol — ez gated, tehát a séma is a
  human review részét képezi a PR-on keresztül).

## Findingok — javítva / elhalasztva

**Ebben a fix körben javítva** (a fixer agent által, a branch már
tartalmazza):
- Jelentett áfa visszaolvasása a `nav_submission`-ból újraszámolás helyett;
  bruttó kerekítési hiba javítva; az audit CTA duplikációja megszűnt.

**Ebben a ship-körben kapott, alacsony súlyosságú finding, felvéve a
`docs/loop-queue.md` Phase 1 szekciójába follow-upként (nem javítva ebben a
ship-kommitban — a Ship csak dokumentál/nyilvántart, nem javít
alkalmazáskódot):**

1. **Alacsony / ux** — a `NavExchangeRateAuditCard.tsx:64-66` címsorának
   `text-destructive` a `bg-destructive/10` háttéren a repó saját
   `lib/theme/contrast.ts` képletével újraszámolva ~4,13:1 kontrasztot ad,
   ami a `WCAG_AA_NORMAL_TEXT` (4,5) alatt van. **Nem regresszió** — a
   `git show main:"app/(app)/invoices/[id]/index.tsx"` megerősítette, hogy
   ugyanez a class-kombináció (428-443. sor) már a slice előtt is létezett
   a hiányzó-árfolyam kártyán; ez a tétel egy második előfordulást ad
   hozzá ugyanahhoz a mintához ugyanazon a képernyőn. Javítás: a
   `--destructive` sötétítése vagy a `bg-destructive` alpha csökkentése
   egyszer, mindkét kártyára, nem kártyánként foltozva.

**Elhalasztva, a terv szerint az emberi jóváhagyási kapunak fenntartva**
(a fixer által, nem a megerősített findingok része, ezért ebben a fix
körben nem lett kezelve):
- OQ-1/OQ-2/OQ-3 a tervből (a `NAV_EXCHANGE_RATE_FIX_AT` deploy- vs.
  commit-pillanat kérdése, `modificationIndex` kezelés egy csak-HUF
  helyesbítőnél, és az örökölt kerekítési/árfolyam-dátum szabály
  kérdései) — terv §10 szerint expliciten az adó-jogi reviewer számára
  fenntartva.
- `reportedNetHuf`/`reportedGrossHuf` továbbra is `lineItems`-alapú
  közelítés (csak `reportedVatHuf` egy perzisztált `nav_submission`
  oszlop, AC1.4/`db/schema.ts` szerint), így elcsúszhatnak, ha a
  tételsorok a NAV-beküldés után szerkesztésre kerülnek. Változatlanul
  hagyva, dokumentálva mint közelítés; mindkettő perzisztálása egy külön,
  saját gated slice-ot igényelne.

## Következő javasolt tétel

A 11. tétel most emberi jóváhagyásra vár (PR #25), így nem tovább
munkálható a loopban, amíg a review nem érkezik meg. Két, nem-gated
lehetőség a `docs/loop-queue.md`-ben:

1. A fentebb felvett alacsony/ux finding (a `--destructive` kontraszt) —
   gyors, önálló, nem-gated follow-up, mindkét érintett kártyát egyszerre
   javítja.
2. A Phase 1 "Remaining for the launch gate" listán nyitva álló "NAV OSA
   round-trip verification" tétel (`docs/loop-queue.md`, kb. 870. sor
   környékén) — `queryInvoiceData` implementálása és egy valódi
   `NAV_TEST_*` fiók elleni round-trip teszt, ami a launch gate egy
   nyitott pontját zárná.
