# InvoHub product roadmap after the first slice

## Phase 1 — launch gates for the approved foundation

- Hungarian lawyer and DPO review of all legal drafts; replace every placeholder.
- Production security/privacy review, processor inventory, retention rules, backups, recovery, monitoring, and incident procedure.
- NAV Online Számla end-to-end certification with test and production credentials.
- Billing/pricing decisions, support policy, accessibility review, mobile store readiness, and domain/auth cutover verification.
- Confirm every marketing compliance claim against implemented production behavior.

## Phase 2 — bank matching

Add consented bank connectivity, normalized transaction ingestion, deterministic and reviewable invoice matching, exception handling, reconciliation audit history, and provider/security review. Gate launch on sandbox and failure-mode coverage; never auto-finalize uncertain matches.

## Phase 3 — EV tax calculator

Model supported Hungarian sole-proprietor tax regimes with versioned rules, effective dates, explainable calculations, source references, warnings, and accountant review workflows. Gate launch on Hungarian tax-professional validation and regression fixtures. Clearly separate estimates from tax advice.

## Phase 4 — machine-to-machine submission

Provide scoped API credentials, idempotent submission endpoints, signed webhooks, rate limits, replay protection, audit logs, retry/dead-letter handling, and tenant isolation. Gate launch on threat modeling, external API documentation, load testing, and NAV failure/recovery verification.

These phases intentionally exclude speculative UI from the first slice. Each starts only after the preceding launch gates and foundational telemetry (with valid consent where required) are in place.

For engineering sequencing after the premium landing/brand ship and Tick 1 (blog + SEO), follow the TDD phases in `docs/tdd-phases.md` (dashboard/invoice polish → bank matching → EV tax). See also `docs/loop-queue.md`.
