// docs/tdd-phases.md
# Next TDD development phases (after landing branding)

Ship order after the premium landing / brand PR is on `main`:

## Phase 0 — Marketing content & SEO (Tick 1) ✅

Landing conversion polish, static typed blog (`lib/blog/`), sitemap/robots, per-page SEO meta + JSON-LD. Do not reopen for bank matching or EV tax work.

## Phase A — Dashboard & invoice polish (TDD first)

1. Write failing unit/hook/E2E tests for dashboard summary accuracy, invoice list filters, create→preview→PDF happy path.
2. Implement the smallest UI/API changes to green the suite.
3. Keep marketing claims aligned with shipped behavior.

## Phase B — Bank matching

1. Spec + fixtures for consent, transaction ingestion, deterministic match candidates, and review UI.
2. Tests before provider wiring; never auto-finalize uncertain matches.
3. See also `docs/product-roadmap.md` Phase 2.

## Phase C — EV / sole-proprietor tax calculator

1. Versioned rule fixtures and explainable calculation tests first.
2. UI second; clearly separate estimates from tax advice.
3. See also `docs/product-roadmap.md` Phase 3.

Do **not** start Phases B/C inside marketing/landing PRs. Next recommended tick after Phase 0: **Phase A**.
