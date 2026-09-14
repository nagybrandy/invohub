// docs/product-roadmap.md
# InvoHub product roadmap

InvoHub is a Hungarian invoicing app for **egyéni vállalkozók (EV)** —
sole proprietors. The product ships in four ordered phases; each phase's
launch gate must be satisfied before the next phase's features reach
users, and marketing copy may only claim what has shipped and passed its
gate (see `CLAUDE.md`). Engineering sequencing for each phase follows
`docs/tdd-phases.md`; the live backlog lives in `docs/loop-queue.md`,
including a Phase 0 Stabilization bucket for cross-cutting hardening that
doesn't belong to a single feature phase.

## Phase 1 — Core invoicing, NAV-compliant

Mandatory invoice fields, AAM/TAM/fordított adózás handling, gapless
invoice numbering, storno/helyesbítő corrections, and NAV Online Számla
submission.

**Launch gate:**
- Hungarian invoicing rules verified against Áfa tv. 169. § (see
  `.claude/skills/hu-invoicing-rules/SKILL.md`), including AAM/TAM/reverse-
  charge legal text.
- NAV Online Számla end-to-end certification with test credentials —
  production credentials and calls remain out of scope for any automated
  agent.
- Production security/privacy review, processor inventory, retention
  rules, backups, recovery, and monitoring.
- Hungarian lawyer and DPO review of all legal drafts; replace every
  placeholder.
- Billing/pricing decisions, support policy, accessibility review, mobile
  store readiness, and domain/auth cutover verification.
- Confirm every marketing compliance claim against implemented production
  behavior (see `.claude/skills/claims-check/SKILL.md`).

## Phase 2 — Bank data connection & paid/unpaid matching

Add bank statement ingestion and deterministic, reviewable invoice
matching. **CSV and camt.053 file import ship first** — before any live
bank/PSD2 connection is built. **Never auto-finalize an uncertain match**;
only exact, unambiguous matches may auto-confirm, everything else goes to
a human review queue.

**Launch gate:** sandbox and failure-mode coverage for the import/matching
path; a provider and security review before any live PSD2/bank connection
is added on top of file import.

## Phase 3 — EV tax calculator

Model supported Hungarian sole-proprietor tax regimes with year-versioned
rules (`lib/tax/rules/<year>.ts`, see `.claude/skills/ev-tax-rules/SKILL.md`),
effective dates, explainable calculations, source references, and clear
"estimate, not tax advice" warnings.

**Launch gate:** validation by a Hungarian tax professional against
regression fixtures, tracked as its own sign-off in `docs/loop-queue.md` —
never assumed just because the rule files exist.

## Phase 4 — NAV M2M tax-return submission

Scoped API credentials, idempotent submission endpoints, signed webhooks,
rate limits, replay protection, audit logs, retry/dead-letter handling,
tenant isolation, and the power-of-attorney (meghatalmazás) flow required
for InvoHub to submit on a user's behalf. This is the phase that actually
replaces the accountant relationship the product is named for.

**Launch gate:** threat modeling, external API documentation, load
testing, NAV failure/recovery verification, and **a legal review before
any marketing copy claims InvoHub replaces an accountant** — that specific
claim must not ship without explicit sign-off.

## How phases relate to engineering work

These phases intentionally exclude speculative UI ahead of their turn.
Each phase starts only after the preceding phase's launch gate is
satisfied and foundational telemetry (with valid consent where required)
is in place. Phase 0 Stabilization items in `docs/loop-queue.md` (security
hardening, test fixtures, credential encryption, i18n gaps) can proceed
alongside any phase — they're prerequisites for shipping any phase safely,
not a phase of their own.

For engineering sequencing, follow `docs/tdd-phases.md`. For the concrete,
checkbox-level backlog, see `docs/loop-queue.md`.
