// docs/audits/README.md
# Audit reports

This directory holds dated output from the `continuous-audit` workflow
(`.claude/workflows/continuous-audit.js`) and any manual audit runs of the
same review dimensions.

## Layout

```
docs/audits/
  README.md              this file
  <YYYY-MM-DD>/
    REPORT.md             triage summary: findings by dimension, most
                           severe first, with file:line evidence and
                           suggested fixes
    screens/               Playwright screenshots from the UX/UI review
                           dimensions (mobile 375px + desktop 1440px)
```

## Review dimensions

Each report covers six dimensions, one review agent per dimension (see
`.claude/agents/`), each verified by an independent skeptic pass before
being included:

| Dimension | Agent | Focus |
|---|---|---|
| `ux-mobile` | `ux-reviewer` | 375px viewport UX |
| `ux-desktop` | `ux-reviewer` | 1440px viewport UX |
| `ui` | `ui-reviewer` | `docs/brand.md` tokens, contrast, spacing, a11y |
| `feature` | `feature-auditor` | Hungarian invoicing/NAV compliance |
| `security` | `security-reviewer` | auth, credentials, secrets |
| `i18n-claims` | `i18n-claims-checker` | HU/EN parity, marketing claims vs. shipped |

## What happens to findings

Every HIGH or MEDIUM finding that isn't already covered by an existing
`docs/loop-queue.md` item gets appended there as a new unchecked item under
the correct phase. LOW findings are recorded in the dated `REPORT.md` but
are not auto-added to the backlog — triage them manually if they're worth
tracking.

## Running an audit

```
Workflow({ name: "continuous-audit", args: { date: "2026-09-14" } })
```

`args.date` must be supplied by the caller as `"YYYY-MM-DD"` — the script
itself cannot read the clock. Use today's date.

To ship the next backlog item instead of auditing, use
`.claude/workflows/ship-next.js` (`Workflow({ name: "ship-next" })`), which
runs one `implementer` agent in an isolated worktree followed by a reviewer
pass on the resulting diff.
