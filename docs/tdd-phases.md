// docs/tdd-phases.md
# TDD engineering phases

Engineering sequencing for the four product phases in
`docs/product-roadmap.md` and `CLAUDE.md`. Every phase is TDD: write a
failing test, then the smallest implementation that passes it (see
`.claude/skills/ship-slice/SKILL.md`). The checkbox-level backlog lives in
`docs/loop-queue.md`.

## Phase 0 — Stabilization ✅ ongoing

Cross-cutting hardening that isn't specific to one product phase: seed/
admin-endpoint security, reminders-cron reliability, an auth E2E test
fixture, credential-encryption verification, export size limits, and i18n
gap sweeps. Can run alongside any other phase's work; see
`docs/loop-queue.md` Phase 0 for the current items.

## Phase A — Marketing content & SEO ✅ done

Landing conversion polish, static typed blog (`lib/blog/`), sitemap/robots,
per-page SEO meta + JSON-LD, HU/EN marketing copy and floating nav. Do not
reopen this for bank-matching or tax-calculator work.

## Phase B — Core invoicing, NAV-compliant (product Phase 1)

1. Write failing unit/hook/E2E tests for the remaining Phase 1 gaps:
   AAM/TAM/reverse-charge text, numbering-sequence concurrency, payment
   fields, storno/helyesbítő linkage, invoice edit screen, NAV OSA client
   wiring + status polling, and `queryTaxpayer` company lookup.
2. Implement the smallest change to green each test, one backlog item at a
   time per `.claude/skills/ship-slice/SKILL.md`.
3. Keep marketing claims aligned with shipped behavior throughout — run
   `.claude/skills/claims-check/SKILL.md` before considering an item done
   if it touches anything user-visible.
4. See also `docs/product-roadmap.md` Phase 1 and
   `.claude/skills/hu-invoicing-rules/SKILL.md`.

## Phase C — Bank matching (product Phase 2)

1. Spec + fixtures for CSV/camt.053 import first — no live bank connection
   until file import has shipped and been used.
2. Tests before any provider wiring; never auto-finalize uncertain
   matches — the review UI for non-exact candidates is part of the launch
   gate, not a follow-up.
3. See also `docs/product-roadmap.md` Phase 2.

## Phase D — EV / sole-proprietor tax calculator (product Phase 3)

1. Versioned rule fixtures (`lib/tax/rules/<year>.ts`) and explainable
   calculation tests first, per `.claude/skills/ev-tax-rules/SKILL.md`.
   Never hardcode a figure without a source — leave a sourced TODO.
2. Calculator UI second, with the required disclaimer in both locales.
3. Tax-professional validation is a tracked backlog item, not an assumption
   once tests pass. See also `docs/product-roadmap.md` Phase 3.

## Phase E — M2M tax-return submission (product Phase 4)

1. Idempotency, signed-webhook, and retry/dead-letter tests first, against
   `test`-environment NAV M2M credentials only.
2. Power-of-attorney (meghatalmazás) flow spec and implementation — this
   gates submission, not just the API credential.
3. No marketing copy claiming InvoHub "replaces the accountant" ships
   without the legal review this phase's launch gate requires. See also
   `docs/product-roadmap.md` Phase 4.

Do **not** start Phase C, D, or E work inside a marketing/landing PR, and
do not start a later phase's feature work before the current phase's
launch gate is satisfied — Phase 0 Stabilization items are the exception
and can run anytime. Next recommended focus after Phase A: **Phase B**
(the Phase 1 launch-gate items still open in `docs/loop-queue.md`).
