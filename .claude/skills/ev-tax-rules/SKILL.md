---
name: ev-tax-rules
description: Structure and rules for encoding year-versioned Hungarian EV (sole-proprietor) tax rules in lib/tax/rules/<year>.ts — sourcing, explainability, and disclaimer requirements. Used when building the Phase 3 EV tax calculator, or by the tax-rules-researcher agent.
---

# EV tax rules — versioned rule files

Hungarian sole-proprietor (EV) tax rules (KATA eligibility, átalányadózás
jövedelem-hányad percentages, contribution rates and minimums, thresholds)
change nearly every year, sometimes mid-year. InvoHub's EV tax calculator
(Phase 3, not yet built) must never hardcode a single "current" rule set —
every figure is versioned and sourced.

## File layout

```
lib/tax/rules/<year>.ts     // e.g. lib/tax/rules/2026.ts
lib/tax/rules/index.ts      // picks the right year-file for a given date
lib/tax/rules/<year>.test.ts
```

## Required shape per rule file

Each `lib/tax/rules/<year>.ts` exports a typed object where **every
figure carries its source and effective range** — never a bare number:

```ts
export const taxRules2026 = {
  year: 2026,
  atalanyadozas: {
    jovedelemHanyad: {
      general: {
        value: 0.4, // 40% — TODO(source): confirm against NAV/2026 rule
        source: "https://nav.gov.hu/...", // official source only
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        confidence: "unconfirmed", // "confirmed" | "unconfirmed"
      },
      // ...other activity-type percentages
    },
  },
  contributions: {
    // TB, SZJA, SZOCHO rates and minimum bases, same {value, source,
    // effectiveFrom, effectiveTo, confidence} shape
  },
} as const;
```

- **Never** invent or "reasonably estimate" a figure you're not sure of.
  Leave `value: null` (or omit) and a `TODO(source): ...` comment naming
  exactly what needs to be looked up, so the gap is visible in a diff and
  in the calculator UI (render "ellenőrizendő" / "needs verification"
  rather than a number) instead of silently defaulting.
- Sources must be official: nav.gov.hu, njt.hu (Nemzeti Jogszabálytár), or
  Magyar Közlöny. A secondary source (accounting-firm explainer) can
  accompany an official one but never replace it.

## Explainability

The calculator's output must show its work: which rule values were used,
their source links, and the arithmetic path from income to tax owed — not
just a final number. A user (or a tax professional reviewing the tool)
should be able to verify every step against the cited source.

## Required disclaimer

Any UI surfacing a calculated figure must carry a visible disclaimer,
substantially: "Ez egy becslés, nem adótanácsadás — az adóügyeit egyeztesse
könyvelővel / adótanácsadóval." (English: "This is an estimate, not tax
advice — consult a bookkeeper/tax advisor about your specific situation.")
Both `hu.ts` and `en.ts` need this key.

## Launch gate

Per `docs/product-roadmap.md` Phase 3, this calculator does not ship to
users until a Hungarian tax professional has validated the rule files
against regression fixtures. `tax-rules-researcher` agent output is always
a draft — see its own instructions. A human sign-off is required before any
`lib/tax/rules/<year>.ts` file backs a shipped calculation; track that
sign-off as a checked item in `docs/loop-queue.md` Phase 3, not assumed.
