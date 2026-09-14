---
name: i18n-sync
description: Use to check Hungarian/English translation key parity between lib/i18n/locales/hu.ts and en.ts, and to find screens/components rendering hardcoded user-facing text instead of useTranslation(). Used by the i18n-claims-checker agent and anyone adding user-facing strings.
---

# i18n sync check

InvoHub uses `react-i18next` with two locale files: `lib/i18n/locales/hu.ts`
(Hungarian, primary — this is an EV-focused Hungarian product) and
`lib/i18n/locales/en.ts` (English). Every user-facing string needs a key in
**both** files in the same change (AGENTS.md / CLAUDE.md workflow rule).

## Key-parity check (script idea)

There's no committed script for this yet — write one inline as needed, or
add `scripts/check-i18n-parity.mjs` as a real slice via `ship-slice`. The
approach:

1. Load both locale modules (they're plain nested TS objects exporting
   translation trees — import via `tsx`/`ts-node` or parse structurally).
2. Flatten both to dot-path key lists (e.g. `dashboard.overdueLabel`).
3. Diff the two key-path sets:
   - Keys in `hu.ts` missing from `en.ts` → reported as "missing EN".
   - Keys in `en.ts` missing from `hu.ts` → reported as "missing HU" (should
     be rarer since Hungarian is primary, but still a bug if it happens).
4. For keys present in both, flag identical string values as *possibly*
   untranslated — but expect false positives for brand names, numbers, and
   short technical tokens; don't report those without eyeballing them.

A minimal version can run as plain Node with a regex-based key-path walk if
importing the TS modules directly isn't convenient in the calling context;
prefer a real import (via the project's existing `ts-node`/`jest`
transform) over a hand-rolled parser when running inside a test or script
that already has the TS toolchain available.

## Untranslated-screen check

Grep `app/` and `components/` for JSX text nodes and string props
(`title=`, `label=`, `placeholder=`, `accessibilityLabel=`) that look like
user-facing English/Hungarian prose but aren't wrapped in `t("...")` /
don't come from a `useTranslation()` hook result. This is a heuristic, not
exact — code comments, internal-only strings (test ids, route names), and
genuinely locale-independent text (numbers, currency symbols formatted via
`Intl`) are not violations.

## Reporting

Findings go through the i18n-claims-checker agent's output format. A
missing-key finding's suggested fix names the exact key path to add to
each file. An untranslated-screen finding names the file:line and the
literal string found.
