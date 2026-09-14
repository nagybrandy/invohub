---
name: claims-check
description: Use to check that marketing/ copy only claims features InvoHub has actually shipped and phase-gated, per the 4-phase roadmap in CLAUDE.md and docs/product-roadmap.md. Used by the i18n-claims-checker agent and anyone editing marketing/ content.
---

# Marketing claims check

InvoHub's phase order (see `CLAUDE.md`): (1) core invoicing, NAV-compliant
→ (2) bank data connection & paid/unpaid matching → (3) EV tax calculator
→ (4) NAV M2M tax-return submission replacing the accountant. Marketing
copy must only make present-tense claims about what's shipped **and past
its launch gate** — not merely coded, and not merely started.

## How to check a claim

1. Grep `marketing/` for feature language: bank/bank account/PSD2/import,
   "adó" / tax calculator, NAV submission/beküldés, "helyettesíti a
   könyvelőt" ("replaces your accountant") or equivalent phrasing, and any
   specific tax percentage or figure.
2. For each claim found, identify which phase it belongs to and check
   `docs/loop-queue.md` for whether that phase's relevant items are
   checked off **and** whether `docs/product-roadmap.md`'s launch gate for
   that phase is satisfied (not just "code exists").
3. Distinguish tenses:
   - Present tense ("InvoHub connects to your bank", "kiszámolja az
     adóját") about a gated/unshipped feature → **violation**, flag it.
   - Future/roadmap tense ("hamarosan", "coming soon", a roadmap page
     explicitly labeled as such) → fine, not a violation.
4. The single highest-stakes claim to check every time: nothing may say or
   imply InvoHub **replaces an accountant** until Phase 4 has shipped AND
   had the legal review `CLAUDE.md` requires. Treat this claim as
   forbidden by default.
5. Also check tax-figure claims specifically: a marketing page stating a
   specific tax rate or amount must trace to a sourced, dated figure (see
   `.claude/skills/ev-tax-rules/SKILL.md`) — not a marketing-authored
   guess.

## Output

Findings go through the i18n-claims-checker agent's output format
(severity + where + evidence + fix). A violation's suggested fix is either
"remove/soften to future tense" or "cite the shipped, gated feature this
actually refers to" — never "add the feature" (that's out of scope for a
marketing-copy fix).
