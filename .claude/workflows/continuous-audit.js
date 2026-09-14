export const meta = {
  name: 'continuous-audit',
  description: 'Run all 6 InvoHub review dimensions (UX mobile/desktop, UI, feature compliance, security, i18n/claims), verify each finding with a skeptic pass, dedupe, and write a dated report plus new loop-queue items.',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
    { title: 'Triage' },
  ],
}

// Plain JS only — no TypeScript syntax, no Date.now()/Math.random()/new Date().
// args.date must be passed in by the caller as "YYYY-MM-DD" (used for
// docs/audits/<date>/ — the script itself cannot read the clock).

if (!args || !args.date || typeof args.date !== 'string') {
  throw new Error(
    'continuous-audit requires args.date as a "YYYY-MM-DD" string (e.g. Workflow({..., args: { date: "2026-09-14" }})).',
  )
}
const AUDIT_DATE = args.date

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'title', 'file', 'evidence', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    reportPath: { type: 'string' },
    itemsAppended: { type: 'number' },
    summary: { type: 'string' },
  },
  required: ['reportPath', 'itemsAppended', 'summary'],
}

// Each dimension maps to one of the read-only reviewer subagents defined
// under .claude/agents/. ux-mobile and ux-desktop both use ux-reviewer,
// scoped to one viewport each so neither run is diluted.
const DIMENSIONS = [
  {
    key: 'ux-mobile',
    agentType: 'ux-reviewer',
    prompt:
      'Run a UX review of InvoHub scoped to the MOBILE viewport (375x812) only — skip desktop entirely this pass. Follow .claude/skills/ux-audit/SKILL.md to start the right server(s) and capture screenshots under docs/audits/' +
      AUDIT_DATE +
      '/screens/. Return every finding via the required schema; return an empty findings array if you find nothing worth flagging rather than inventing minor nitpicks.',
  },
  {
    key: 'ux-desktop',
    agentType: 'ux-reviewer',
    prompt:
      'Run a UX review of InvoHub scoped to the DESKTOP viewport (1440x900) only — skip mobile entirely this pass. Follow .claude/skills/ux-audit/SKILL.md to start the right server(s) and capture screenshots under docs/audits/' +
      AUDIT_DATE +
      '/screens/. Return every finding via the required schema; return an empty findings array if you find nothing worth flagging rather than inventing minor nitpicks.',
  },
  {
    key: 'ui',
    agentType: 'ui-reviewer',
    prompt:
      'Run a visual-design review of InvoHub against docs/brand.md tokens (palette, contrast, spacing, typography, accessibility). Return every finding via the required schema; return an empty findings array if nothing is worth flagging.',
  },
  {
    key: 'feature',
    agentType: 'feature-auditor',
    prompt:
      'Audit InvoHub for Hungarian invoicing/NAV compliance per .claude/skills/hu-invoicing-rules/SKILL.md — mandatory fields, AAM/TAM/fordított adózás text, numbering continuity, storno/helyesbítő linkage, NAV OSA submission correctness. Return every finding via the required schema, labeling anything uncertain as needing human tax verification in the fix field.',
  },
  {
    key: 'security',
    agentType: 'security-reviewer',
    prompt:
      'Review InvoHub for security issues — auth/session checks on API routes, credential encryption at rest, secrets in code/logs, seed/demo-data safety, NAV/M2M environment defaults. Return every finding via the required schema.',
  },
  {
    key: 'i18n-claims',
    agentType: 'i18n-claims-checker',
    prompt:
      'Check InvoHub HU/EN i18n key parity and marketing claims vs. shipped behavior per .claude/skills/i18n-sync/SKILL.md and .claude/skills/claims-check/SKILL.md. Return every finding via the required schema.',
  },
]

log('Starting continuous audit for ' + AUDIT_DATE + ' across ' + DIMENSIONS.length + ' dimensions.')

// pipeline: each dimension runs Review then Verify independently — a slow
// UX screenshot pass doesn't block a fast security grep from moving to
// verification. Dedup only happens after the whole pipeline settles, which
// is the point where we genuinely need every dimension's result together.
const perDimension = await pipeline(
  DIMENSIONS,
  (dim) =>
    agent(dim.prompt, {
      schema: FINDINGS_SCHEMA,
      agentType: dim.agentType,
      phase: 'Review',
      label: dim.key,
    }),
  (reviewResult, dim) => {
    const findings = reviewResult && Array.isArray(reviewResult.findings) ? reviewResult.findings : []
    if (findings.length === 0) {
      log(dim.key + ': no findings, skipping verification.')
      return { findings: [] }
    }
    return agent(
      'You are a skeptical verifier. Try to REFUTE each of the following findings about the InvoHub codebase — re-check the file/line, confirm the evidence actually shows what it claims, and drop anything that does not hold up on inspection. Default to dropping a finding if you cannot personally confirm it. Return only the findings that survive, in the same shape.\n\nFindings to verify:\n' +
        JSON.stringify(findings, null, 2),
      { schema: FINDINGS_SCHEMA, phase: 'Verify', label: dim.key + '-verify' },
    )
  },
)

const tagged = perDimension.flatMap((result, i) => {
  const findings = result && Array.isArray(result.findings) ? result.findings : []
  return findings.map((f) => Object.assign({}, f, { dimension: DIMENSIONS[i].key }))
})

log('Verified findings before dedupe: ' + tagged.length)

// Dedupe by file + title (case-insensitive) — plain code, no agent needed.
const dedupedByKey = new Map()
for (const finding of tagged) {
  const key = String(finding.file || '').toLowerCase() + '::' + String(finding.title || '').toLowerCase()
  if (!dedupedByKey.has(key)) {
    dedupedByKey.set(key, finding)
  }
}
const deduped = Array.from(dedupedByKey.values())

log('Findings after dedupe: ' + deduped.length)

phase('Triage')

if (deduped.length === 0) {
  log('No findings survived verification — writing an empty report, nothing to append to loop-queue.')
}

const triage = await agent(
  'Write the continuous-audit report for InvoHub.\n\n' +
    '1. Create docs/audits/' +
    AUDIT_DATE +
    '/REPORT.md summarizing every finding below, grouped by dimension, most severe first within each group. If a docs/audits/' +
    AUDIT_DATE +
    '/screens/ directory already exists from the review agents, reference relevant screenshots by filename.\n' +
    '2. Read docs/loop-queue.md and CLAUDE.md to see the current phase structure. For each HIGH or MEDIUM severity finding that is not already represented by an existing loop-queue item, append a new unchecked "- [ ]" item under the correct phase section (infer the phase from the finding: NAV/invoicing compliance -> Phase 1, bank/matching -> Phase 2, tax -> Phase 3, M2M -> Phase 4, anything else foundational -> Phase 0 Stabilization). Do not duplicate an item that already covers the same gap — check existing text first. Do not remove or uncheck any existing item.\n' +
    '3. Do not edit any application code — only docs/audits/**and** docs/loop-queue.md.\n\n' +
    'Findings:\n' +
    JSON.stringify(deduped, null, 2),
  { schema: TRIAGE_SCHEMA, phase: 'Triage' },
)

log('Report written to ' + (triage ? triage.reportPath : '(triage agent failed)'))

return {
  date: AUDIT_DATE,
  dimensions: DIMENSIONS.map((d) => d.key),
  findingsCount: deduped.length,
  triage,
}
