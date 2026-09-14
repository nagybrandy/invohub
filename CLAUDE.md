@AGENTS.md

# InvoHub — product & workflow guide for agents

## Product vision

InvoHub is a Hungarian invoicing app for **egyéni vállalkozók (EV)** — sole
proprietors. It replaces the accountant relationship in four ordered phases.
Do not build ahead of the current phase, and never let marketing claim a
feature that has not shipped and passed its launch gate.

## Phase order & launch gates

1. **Core invoicing, NAV-compliant** — mandatory invoice fields, AAM/TAM/
   fordított adózás handling, continuous numbering, storno/helyesbítő,
   NAV Online Számla submission (demo/test/production modes). Launch gate:
   Hungarian invoicing rules verified against Áfa tv. 169. §, NAV OSA
   end-to-end certified with test credentials, security/privacy review.
2. **Bank data connection & paid/unpaid matching** — CSV / camt.053 import
   **first**, before any live bank/PSD2 connection. Deterministic, reviewable
   match candidates. **Never auto-finalize an uncertain match** — only exact,
   unambiguous matches may auto-confirm; everything else goes to a human
   review queue. Launch gate: sandbox + failure-mode coverage, provider/
   security review if a live connection is added.
3. **EV tax calculator** — year-versioned rule files with sources and
   effective dates, explainable calculations, clear "estimate, not advice"
   disclaimers. Launch gate: validation by a Hungarian tax professional
   against regression fixtures. Never hardcode a tax figure nobody has
   verified — leave a sourced TODO instead.
4. **NAV M2M tax-return submission** — scoped credentials, idempotent
   submission, signed webhooks, retry/dead-letter handling, audit logs.
   This is the phase that actually "replaces the accountant." Launch gate:
   threat model, load testing, NAV failure/recovery verification, and a
   **legal review before any marketing copy claims InvoHub replaces an
   accountant** — that claim must not ship without sign-off.

Marketing (`marketing/`) may only describe what is shipped and gated. A
feature behind a phase gate is "coming soon" language at most, never a
present-tense claim.

## Workflow rules

- **1 backlog item = 1 branch = 1 PR.** Pick the top unchecked item in
  `docs/loop-queue.md` under the current phase; don't bundle unrelated items.
- **TDD.** Write a failing test first, then the smallest implementation that
  passes it. Every change ships with tests (see AGENTS.md §9).
- **Reviewer agents are read-only.** They report findings; they never edit
  app code. Only `implementer` writes code, and only on its own branch.
- **Humans merge.** No agent merges or pushes to a remote. No agent pushes
  to any git remote, period.
- **Tax and legal items need explicit human sign-off** before merge — this
  includes anything under `lib/tax/`, `lib/nav/`, `lib/m2m/`, and any
  marketing copy about compliance, tax figures, or "replacing the
  accountant." Reviewer agents must flag these; they cannot approve them.
- No local `.env` and no live database exist in this environment. Never run
  `db:push`. Tests mock `@/db` — never require a live Postgres connection.
  Never call NAV production endpoints; use `demo`/`test` NAV modes only.
  Never invent or commit credentials.

## Where state lives

- `docs/loop-queue.md` — the backlog, grouped by phase, checkbox items.
- `docs/audits/YYYY-MM-DD/` — dated audit reports from the continuous-audit
  workflow (`REPORT.md` + screenshots under `screens/`).
- `docs/decisions/` — ADRs for decisions worth remembering (create this
  directory the first time an agent needs to record one).
- `docs/product-roadmap.md` / `docs/tdd-phases.md` — the phase narrative and
  engineering sequencing, kept consistent with this file.

## NAV modes

NAV Online Számla and the M2M tax-return API both have `test` and
`production` environment types (`lib/nav/environment.ts`,
`lib/m2m/environment.ts`); `lib/m2m/demo-user.ts` and `lib/m2m/test-fixtures.ts`
provide a **demo** path — a fixture/random-test-taxpayer flow — for
exploring the M2M API without a real taxpayer. Agents and CI must only ever
run against `test` environment credentials, or the demo fixture path. Never
invoke `production` — this repo has no live production NAV credential, and
none should ever be invented or committed.
