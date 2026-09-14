export const meta = {
  name: 'ship-next',
  description: 'Have one implementer agent ship the top unchecked docs/loop-queue.md item on an isolated worktree branch (TDD), then have a reviewer agent review the resulting diff.',
  phases: [
    { title: 'Implement' },
    { title: 'Review' },
  ],
}

// Plain JS only — no TypeScript syntax, no Date.now()/Math.random()/new Date().

const SHIP_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    backlogItem: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    typecheckPassed: { type: 'boolean' },
    testsPassed: { type: 'boolean' },
    schemaChanges: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['branch', 'backlogItem', 'testsPassed', 'summary'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['approve', 'changes-requested'] },
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
    summary: { type: 'string' },
  },
  required: ['verdict', 'findings', 'summary'],
}

phase('Implement')
log('Spawning implementer in an isolated worktree to ship the top unchecked backlog item.')

const shipped = await agent(
  'Follow .claude/skills/ship-slice/SKILL.md exactly: pick the single top unchecked item in docs/loop-queue.md (in phase order), branch as slice/<slug>, write a failing test first, implement the smallest change, run npm run typecheck and npm run test:unit (plus npx jest on your touched paths), update the loop-queue checkbox, and commit. Do not merge and do not push to any remote. If the item needs tax/legal sign-off you do not have, do the scaffolding/tests only and say so in your summary rather than inventing figures or claims. List any db/schema.ts changes explicitly — do not run db:generate or db:push.',
  {
    agentType: 'implementer',
    isolation: 'worktree',
    schema: SHIP_SCHEMA,
    phase: 'Implement',
  },
)

if (!shipped) {
  log('Implementer produced no result (skipped by the user, or errored) — nothing to review.')
  return { shipped: null, review: null }
}

log('Implementer finished on branch ' + shipped.branch + ': ' + shipped.summary)

phase('Review')

if (!shipped.testsPassed) {
  log('Implementer reported failing tests — reviewer will focus on why, not just style.')
}

const review = await agent(
  'Review the diff on git branch "' +
    shipped.branch +
    '" against its base (use git log/diff to find it — do not assume main). ' +
    'This is a read-only code review: do NOT edit, stage, or commit anything. ' +
    'Check correctness first (does the implementation actually satisfy the backlog item: "' +
    shipped.backlogItem +
    '"?), then look for missed edge cases, AGENTS.md rule violations (style arrays on web, missing webDomProps, FlatList empty-state JSX), missing hu.ts/en.ts key parity for any new string, and whether the failing-test-first claim is credible from the diff. ' +
    'Flag anything that touches tax figures, legal/marketing copy, or NAV production defaults as needing explicit human sign-off rather than approving it outright. ' +
    'Report a verdict of "approve" only if you found no high-severity issues.',
  { schema: REVIEW_SCHEMA, phase: 'Review' },
)

if (!review) {
  log('Reviewer produced no result (skipped or errored).')
}

return { shipped, review }
