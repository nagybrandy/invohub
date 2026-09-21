# Ship report — fix-notification-bell-language-switcher-hitslop-overlap

**Dátum:** 2026-09-21
**Tétel:** `components/navigation/MobileAppHeader.tsx` új `hitSlop={8}`-ja az
értesítés-harangon (a `slice/invoice-flow-tap-targets-44px` AC9 pontja miatt
került be) most átfedésbe kerül a `LanguageSwitcher` már meglévő
`hitSlop={8}`-jával a köztük lévő közös `HStack space="sm"` (8px) résen át,
így egy vitatott érintési sávot hoz létre, ahol RN hit-testje dönti el, melyik
elemet találja a tap. Ship-review follow-up
(`docs/loop-queue.md`, Phase 1, "Prioritás" lista 8. pontja alatt).
**Terv:** a `fixround1-composer-line-item-horizontal-scroll-1440` ágon
(commit `80c9c8e`, "Plan: fix-notification-bell-language-switcher-hitslop-overlap")
íródott, de ez az ág nem lett mergelve; a build/fix agentek a
`docs/loop-queue.md`-ben rögzített finding-szöveget és a tényleges
implementációt/teszteket használták hatókörként — ugyanaz a minta, mint a
2026-09-18-as `invoice-flow-tap-targets-44px` ship-körnél. A plan fájl emiatt
jelenleg nincs a `main`-en; a `docs/loop-queue.md` rá mutató hivatkozása egy
más ágon élő dokumentumra utal.
**Branch:** `slice/fix-notification-bell-language-switcher-hitslop-overlap`
(egyetlen squashed commit: `b82c8c6`, "fix(header): trim hitSlop on sides
facing a neighbour control").
**Bemenő állapot:** Green: true, Gated (tax/legal/NAV-prod): false.

## Eredmény: mergelve és éles telepítve

## Mi shippelt

- Új `hitSlopExcept()` és `touchOverlapPx()` segédfüggvények
  `lib/ui/tap-target.ts`-ben — csak a szomszédos vezérlő felé eső oldalon
  nullázzák le a hitSlopot, a többi oldalon megtartva a 8px-et.
- `MobileAppHeader.tsx`: az értesítés-harang most a `LanguageSwitcher` felőli
  (jobb) oldalán 0 hitSlopot kap, a többi oldalon marad a 8px.
- `LanguageSwitcher.tsx`: a fix közben egy súlyosabb, korábban nem jelentett
  hibát is feltárt ugyanabból a gyökérokból — a HU és EN pill 4px `gap-1`-en
  ült, mindkettő `hitSlop={8}`-cal, így az EN érintési téglalapja átfedte a
  vizuálisan kiválasztott HU chip jobb 4px-ét, és a fordított bejárási
  sorrend miatt az EN nyerte a hit-testet — a "HU" szélének megérintése
  némán angolra váltotta az appot. Ugyanazzal a mintával javítva,
  pillenként (az első kizárja a jobb oldalt, az utolsó a bal oldalt).
- Nincs vizuális változás, a 44px tap-target minimum megmaradt.

## Tesztek

- `npx tsc --noEmit` (main, mergelés után) — **zöld**.
- `npm run test:unit` (main, mergelés után) — **213 suite / 1344 teszt, mind
  zöld**, beleértve az új `lib/ui/tap-target.test.ts`-t, a
  `LanguageSwitcher.test.tsx` érintés-geometriai `describe` blokkját és a
  `MobileAppHeader.test.tsx` AC9 hitSlop-assercióit.
- `db/schema.ts` nem változott ebben a slice-ban — nem volt `db:push`.

## Findingok

**Ebben a ship-körben felvett, nem blokkoló finding (alacsony súlyosság) —
hozzáadva a `docs/loop-queue.md` Phase 1 8. pontja alá follow-upként, nem
javítva ebben a ship-kommitban:**

1. **A branch egyetlen squashed commit** (`b82c8c6`), amiben az új tesztek,
   az implementáció és a `docs/loop-queue.md` frissítése együtt van, így a
   TDD "előbb bukó teszt" sorrend git történetből nem igazolható vissza.
   Ugyanez a megjegyzés már szerepel a `docs/loop-queue.md`-ben a szülő
   slice-nál (`slice/invoice-flow-tap-targets-44px`), amelynek ez a
   follow-upja — a finding megismétlődését a self-note nélkül is
   megerősítettük a szövegre nézve. Nem funkcionális hiba: `tsc --noEmit`
   tiszta, és a teljes `npm run test:unit` (213 suite / 1344 teszt) zöld,
   beleértve a shippelt viselkedést függetlenül igazoló új teszteket is.
   Nincs teendő a shipheléshez; ha a szigorú TDD-provenance fontos, jövőbeli
   slice-ok megőrizhetnek egy red-commit checkpointot squashelés előtt.

**A fixer által elhalasztott pontok:** nincsenek.

## Deploy

- `git push origin main`: `65af670..c58495f`
- `vercel --prod --yes`: **READY** (kb. 8 perc build)
  - `https://invohub-5roxr8b1k-codences-projects.vercel.app`
  - Aliasolva: `https://www.invohub.hu`
- Smoke:
  - `curl https://invohub.vercel.app/` → **200**
  - `curl https://invohub.vercel.app/login` → **200**
  - `PRODUCTION_BASE_URL=https://invohub.vercel.app npm run test:smoke:production`
    → **12/12 teszt zöld** (desktop + mobile projektek)

## Következő javasolt tétel

A `docs/loop-queue.md` Phase 1 "Prioritás" listáján a 7. pont
("Nyugta adatszolgáltatás (e-nyugta) NAV API") jelenleg PR-ként nyitva vár
emberi aláírásra (`slice/e-nyugta-nav-receipt-api`), tax/legal-gated, nem
auto-shippelhető. A 10. pont
(`slice/backfill-non-huf-invoices-missing-exchange-rate`) szintén PR-ként
nyitva áll emberi review-ra. Az első nem gated, nyitott Phase 1 tétel emiatt
a "NAV OSA round-trip verification" — érdemes ezt venni a következő
dev-loop körben, vagy a fennmaradó alacsony súlyosságú follow-upok egyikét
(pl. a `choice-pill` kód-komment pontosítása, vagy a
`ExchangeRateFixBanner`/invoice-detail "add rate" gomb 44px tap-target
floorja) egy gyors, kis kockázatú slice-ként.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
