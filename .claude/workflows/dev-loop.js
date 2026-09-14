export const meta = {
  name: 'dev-loop',
  description: 'One iteration of the continuous product loop: Opus refills the backlog from market research when it is thin, Opus plans the top item, Sonnet builds it TDD-style in a worktree, Sonnet reviewers test it (acceptance + UX mobile/desktop + skeptic), Sonnet fixes, then it ships (merge main, push, additive db:push, vercel --prod, smoke test) unless tax/legal/NAV-production gated.',
  whenToUse: 'Run on a schedule (cron) or on demand to advance InvoHub by exactly one backlog item end to end, including production deploy when green.',
  phases: [
    { title: 'Triage', detail: 'Sonnet: read the backlog, pick the top item, decide whether research is needed', model: 'sonnet' },
    { title: 'Research', detail: 'Opus: market/competitor needs for Hungarian EVs → new backlog items (only when the queue is thin)', model: 'opus' },
    { title: 'Plan', detail: 'Opus: concrete plan + acceptance criteria + risk flags for the picked item', model: 'opus' },
    { title: 'Build', detail: 'Sonnet implementer, TDD, isolated worktree branch', model: 'sonnet' },
    { title: 'Test', detail: 'Sonnet: acceptance check, UX mobile+desktop, then a skeptic verifies every finding', model: 'sonnet' },
    { title: 'Fix', detail: 'Sonnet: fix confirmed high/medium findings, re-verify (max 2 rounds)', model: 'sonnet' },
    { title: 'Ship', detail: 'merge → main, push, additive-only db:push, vercel --prod, production smoke test', model: 'sonnet' },
  ],
}

// Plain JS only — no TypeScript, no Date.now()/Math.random()/new Date().
// Caller passes args.date ("YYYY-MM-DD"). Optional args:
//   research: true  -> force the Research phase even if the queue is not thin
//   dryRun:   true  -> do everything except Ship (no merge/push/deploy)
//   minQueue: N     -> research when fewer than N unchecked items remain (default 6)

if (!args || typeof args.date !== 'string') {
  throw new Error('dev-loop requires args.date as "YYYY-MM-DD".')
}
const DATE = args.date
const DRY_RUN = !!(args && args.dryRun)
const MIN_QUEUE = args && typeof args.minQueue === 'number' ? args.minQueue : 6
const REPO = '/Users/brandy/Developer/invohub'
const PROD_URL = 'https://invohub.vercel.app'

const RULES =
  'Repo: ' + REPO + ' (Expo Router + Gluestack + NativeWind + Better Auth + Drizzle/Neon; Hungarian invoicing for egyéni vállalkozók). ' +
  'Follow CLAUDE.md + AGENTS.md. Product phase order: 1 core invoicing (NAV-compliant) → 2 bank matching → 3 EV tax calculator → 4 NAV M2M filing. ' +
  'Never call NAV/M2M production; never invent credentials or tax figures; marketing may only claim shipped features. ' +
  'Anything touching lib/tax, tax figures, legal/marketing compliance copy, or NAV production defaults is tax/legal-gated: it must NOT auto-ship — it gets a PR for human sign-off instead.'

// ---------- schemas ----------
const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    uncheckedCount: { type: 'number' },
    currentPhase: { type: 'string' },
    topItem: { type: 'string' },
    topItemPhase: { type: 'string' },
    slug: { type: 'string' },
    blocked: { type: 'boolean' },
    blockedReason: { type: 'string' },
  },
  required: ['uncheckedCount', 'currentPhase', 'topItem', 'topItemPhase', 'slug', 'blocked'],
}

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    itemsAdded: { type: 'array', items: { type: 'string' } },
    sourcesConsulted: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['itemsAdded', 'summary'],
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    branch: { type: 'string' },
    planPath: { type: 'string' },
    acceptanceCriteria: { type: 'array', items: { type: 'string' } },
    filesLikely: { type: 'array', items: { type: 'string' } },
    testsToWrite: { type: 'array', items: { type: 'string' } },
    schemaChanges: { type: 'array', items: { type: 'string' } },
    risk: { type: 'string', enum: ['none', 'schema', 'tax-legal', 'nav-production'] },
    riskReason: { type: 'string' },
  },
  required: ['item', 'branch', 'planPath', 'acceptanceCriteria', 'risk'],
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    typecheckPassed: { type: 'boolean' },
    testsPassed: { type: 'boolean' },
    testNotes: { type: 'string' },
    schemaChanges: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    followUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['branch', 'typecheckPassed', 'testsPassed', 'summary'],
}

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
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'title', 'file', 'evidence', 'fix'],
      },
    },
    acceptanceMet: { type: 'boolean' },
  },
  required: ['findings'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    deferred: { type: 'array', items: { type: 'string' } },
    typecheckPassed: { type: 'boolean' },
    testsPassed: { type: 'boolean' },
  },
  required: ['fixed', 'deferred', 'typecheckPassed', 'testsPassed'],
}

const SHIP_SCHEMA = {
  type: 'object',
  properties: {
    merged: { type: 'boolean' },
    pushed: { type: 'boolean' },
    dbPushed: { type: 'boolean' },
    deployed: { type: 'boolean' },
    deployUrl: { type: 'string' },
    smokeOk: { type: 'boolean' },
    prUrl: { type: 'string' },
    reportPath: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['merged', 'pushed', 'deployed', 'smokeOk', 'notes'],
}

// ---------- Triage ----------
phase('Triage')
const triage = await agent(
  RULES +
    '\n\nRead docs/loop-queue.md and CLAUDE.md. Report: how many "- [ ]" items remain in total; the current PRODUCT phase (the earliest of Phase 1–4 that still has unchecked items — Phase 0 is a side queue, never the "current phase"); and the item to build next. ' +
    'SELECTION RULE (owner priority, 2026-09-14): the app\'s actual functionality and user experience come first. If the current phase section starts with a "### Prioritás" numbered list, take the first entry of that list whose matching "- [ ]" item below is still unchecked and not "[~]" — that ordered list overrides file order. Otherwise pick the FIRST unchecked item, top to bottom, in the current product phase whose primary value is user-facing app functionality or UX (a screen, a flow, a calculation the user sees, a NAV/receipt integration that makes the product actually work). ' +
    'Skip: items marked "[~]" (in progress elsewhere), items that are audits/"confirm that"/refactor-only/observability/tooling with no user-visible change, and items tagged as needing tax/legal sign-off unless nothing else remains. Only when no such Phase 1–4 feature item exists may you fall back to a Phase 0 item. ' +
    'Return the exact item text, its phase, and a short kebab-case slug. Set blocked=true with a reason if there is no pickable item. Do not edit anything.',
  { schema: TRIAGE_SCHEMA, phase: 'Triage', model: 'sonnet', effort: 'low', label: 'triage' },
)
if (!triage) throw new Error('Triage agent returned nothing.')
log('Backlog: ' + triage.uncheckedCount + ' unchecked, current phase: ' + triage.currentPhase + '. Top item: ' + triage.topItem)

// ---------- Research (Opus) — only when the queue is thin or forced ----------
let research = null
const needResearch = (args && args.research === true) || triage.uncheckedCount < MIN_QUEUE || triage.blocked
if (needResearch) {
  phase('Research')
  research = await agent(
    RULES +
      '\n\nYou are the product strategist. The backlog (docs/loop-queue.md) has ' + triage.uncheckedCount + ' unchecked items and needs refilling for the CURRENT phase (' + triage.currentPhase + ') and the next one. ' +
      'Research what Hungarian egyéni vállalkozók actually need from an invoicing/EV tool right now: use WebSearch/WebFetch on Hungarian sources (NAV announcements, Számlázz.hu / Billingo / KBOSS feature pages and changelogs, EV forums, 2026 tax-rule changes), and read docs/product-roadmap.md, docs/audits/**/REPORT.md, and the codebase to see what already exists. ' +
      'Then append 4–8 new, concrete, independently shippable "- [ ]" items to docs/loop-queue.md under the correct phase sections (never delete or uncheck anything; never duplicate an existing item; each item 1–4 lines with the user value and a pointer to the code area). Prefer items that move the CURRENT phase toward its launch gate over shiny features. Tag anything tax/legal-sensitive with "(needs tax/legal sign-off)". Commit docs/loop-queue.md with message "Backlog: research refill ' + DATE + '". Return the items added and sources consulted.',
    { schema: RESEARCH_SCHEMA, phase: 'Research', model: 'opus', label: 'research' },
  )
  log('Research added ' + (research ? research.itemsAdded.length : 0) + ' backlog items.')
}

if (triage.blocked && (!research || research.itemsAdded.length === 0)) {
  return { date: DATE, triage, research, stopped: 'no pickable backlog item' }
}

// ---------- Plan (Opus) ----------
phase('Plan')
const plan = await agent(
  RULES +
    '\n\nYou are the planner for exactly one backlog item: "' + triage.topItem + '" (phase ' + triage.topItemPhase + ', slug ' + triage.slug + '). ' +
    (research ? 'The Research phase just added items — if one of them is clearly a higher-value user-facing feature in the same phase than this item, you may pick that instead (say so), but never swap to an audit/refactor/tooling item. ' : '') +
    'Plan for real product quality, not just the literal checkbox: the owner\'s current priority is making the app\'s functions genuinely better for an egyéni vállalkozó (fewer steps, correct Hungarian invoicing behaviour, working NAV/receipt flows, clear mobile + desktop UX). ' +
    'Study the relevant code, tests and docs first. Write a concrete implementation plan to docs/plans/' + DATE + '-<slug>.md containing: goal and user value; acceptance criteria (testable, numbered); files to touch; tests to write first (TDD); i18n keys (hu+en); db/schema.ts changes if any (say ADDITIVE or DESTRUCTIVE explicitly); UX notes for mobile (375px) and desktop; risk classification (none | schema | tax-legal | nav-production) with reason; out-of-scope list. ' +
    'Keep the plan small enough for one Sonnet implementer to finish in one run. Then in docs/loop-queue.md mark the chosen item "[~] folyamatban (slice/<slug>)" and commit both files ("Plan: <slug>"). Branch name must be slice/<slug>.',
  { schema: PLAN_SCHEMA, phase: 'Plan', model: 'opus', label: 'plan' },
)
if (!plan) throw new Error('Plan agent returned nothing.')
log('Plan for "' + plan.item + '" → ' + plan.planPath + ' (risk: ' + plan.risk + ')')

// ---------- Build (Sonnet implementer) ----------
phase('Build')
const build = await agent(
  RULES +
    '\n\nYour role definition is .claude/agents/implementer.md — read it first and follow its hard constraints. Implement exactly this plan: ' + plan.planPath + ' (read it too). Branch: ' + plan.branch + ' off main — run `ln -s ' + REPO + '/node_modules node_modules` if node_modules is missing in your worktree, then `git checkout -b ' + plan.branch + '`. ' +
    'TDD: write the failing tests from the plan first, then the smallest implementation. Add hu+en i18n keys for every new string. If the plan lists db/schema.ts changes, make them in db/schema.ts and run `npx drizzle-kit generate --name <slug>` (no db:push here). ' +
    'Run npm run typecheck, npx jest <touched paths>, npm run test:unit. Acceptance criteria to satisfy: ' + JSON.stringify(plan.acceptanceCriteria) + '. ' +
    'Flip the item to "[x]" in docs/loop-queue.md only if every criterion is met; otherwise leave "[~]" and explain. Commit on the branch. Do not merge or push.',
  { isolation: 'worktree', schema: BUILD_SCHEMA, phase: 'Build', model: 'sonnet', label: 'build' },
)
if (!build) throw new Error('Implementer returned nothing.')
log('Built on ' + build.branch + ': typecheck ' + (build.typecheckPassed ? 'ok' : 'FAIL') + ', tests ' + (build.testsPassed ? 'ok' : 'FAIL'))

// ---------- Test (Sonnet reviewers → skeptic) ----------
phase('Test')
const REVIEW_BASE =
  RULES +
  '\n\nYou are a READ-ONLY reviewer of git branch "' + build.branch + '" (diff it against main). Create your own temporary worktree for it if you need to run the app or tests (`git worktree add /tmp/review-' + triage.slug + ' ' + build.branch + '` + symlink node_modules), and remove it when done. Never edit, stage or commit. Plan: ' + plan.planPath + '. Acceptance criteria: ' + JSON.stringify(plan.acceptanceCriteria) + '. Report only concrete, evidenced findings (file + line or screenshot path), max 12, most severe first; set acceptanceMet honestly.'

const REVIEWS = [
  { key: 'acceptance', prompt: 'Functional review: does the diff actually satisfy every acceptance criterion? Run npm run typecheck and npm run test:unit in the worktree yourself; check edge cases, error states, i18n parity (hu/en), AGENTS.md web rules, and that the failing-test-first claim is credible from the diff.' },
  { key: 'ux', role: '.claude/agents/ux-reviewer.md', prompt: 'UX review of the changed screens at 375x812 AND 1440x900. Follow .claude/skills/ux-audit/SKILL.md to run the app from the worktree and take Playwright screenshots into docs/audits/loop/' + DATE + '-' + triage.slug + '/. Check overflow, tap targets ≥44px, above-fold CTA, loading/empty/error states, Hungarian text length.' },
  { key: 'security', role: '.claude/agents/security-reviewer.md', prompt: 'Security/compliance pass on the diff only: auth + ownership scoping on any new API route, secrets never logged or returned, NAV/M2M never pointed at production, no tax figures or compliance claims added without a sign-off tag.' },
]

const reviewed = await pipeline(
  REVIEWS,
  (r) => agent(REVIEW_BASE + (r.role ? '\n\nYour role definition is ' + r.role + ' — read it first and follow it (read-only).' : '') + '\n\nDIMENSION: ' + r.prompt, { schema: FINDINGS_SCHEMA, phase: 'Test', model: 'sonnet', label: 'review:' + r.key }),
  (res, r) => {
    const findings = res && Array.isArray(res.findings) ? res.findings : []
    if (findings.length === 0) return { key: r.key, findings: [], acceptanceMet: res ? res.acceptanceMet : undefined }
    return agent(
      REVIEW_BASE + '\n\nYou are a SKEPTIC. Try to REFUTE each finding below by re-checking the file/screenshot; keep only what survives, correct overstated severities.\n' + JSON.stringify(findings, null, 1),
      { schema: FINDINGS_SCHEMA, phase: 'Test', model: 'sonnet', label: 'verify:' + r.key },
    ).then((v) => ({ key: r.key, findings: v ? v.findings : findings, acceptanceMet: res ? res.acceptanceMet : undefined }))
  },
)

const seen = new Set()
let confirmed = []
for (const r of reviewed.filter(Boolean)) {
  for (const f of r.findings) {
    const k = (f.file + '|' + f.title).toLowerCase()
    if (!seen.has(k)) { seen.add(k); confirmed.push(Object.assign({}, f, { dimension: r.key })) }
  }
}
const acceptanceMet = reviewed.filter(Boolean).every((r) => r.acceptanceMet !== false)
log('Confirmed findings: ' + confirmed.length + ' (acceptance met: ' + acceptanceMet + ')')

// ---------- Fix (Sonnet, up to 2 rounds) ----------
let fixResult = null
let round = 0
let blocking = confirmed.filter((f) => f.severity !== 'low')
while ((blocking.length > 0 || !build.testsPassed || !build.typecheckPassed || !acceptanceMet) && round < 2) {
  round += 1
  phase('Fix')
  fixResult = await agent(
    RULES +
      '\n\nFix round ' + round + ' on branch ' + build.branch + ' (check it out in your worktree: `git checkout ' + build.branch + '`, symlink node_modules). Fix these confirmed findings and any failing typecheck/tests, keeping the plan\'s scope (' + plan.planPath + '). Record anything you deliberately defer. Commit on the branch; do not merge/push.\nFindings:\n' + JSON.stringify(blocking, null, 1) +
      (build.testsPassed ? '' : '\nImplementer reported failing tests: ' + (build.testNotes || '')),
    { isolation: 'worktree', schema: FIX_SCHEMA, phase: 'Fix', model: 'sonnet', label: 'fix-' + round },
  )
  if (!fixResult) break
  const recheck = await agent(
    REVIEW_BASE + '\n\nRe-verify ONLY these previously confirmed findings after the fix round — return the ones still present:\n' + JSON.stringify(blocking, null, 1),
    { schema: FINDINGS_SCHEMA, phase: 'Fix', model: 'sonnet', label: 'recheck-' + round },
  )
  blocking = recheck ? recheck.findings.filter((f) => f.severity !== 'low') : []
  build.testsPassed = fixResult.testsPassed
  build.typecheckPassed = fixResult.typecheckPassed
  log('After fix round ' + round + ': ' + blocking.length + ' blocking findings remain; tests ' + (fixResult.testsPassed ? 'ok' : 'FAIL'))
}

// ---------- Ship ----------
const gated = plan.risk === 'tax-legal' || plan.risk === 'nav-production'
const green = build.testsPassed && build.typecheckPassed && blocking.length === 0
const lows = confirmed.filter((f) => f.severity === 'low')

phase('Ship')
const ship = await agent(
  RULES +
    '\n\nYou are the SHIP agent working in the MAIN checkout ' + REPO + ' (not a worktree). Branch to ship: ' + build.branch + '. Item: "' + plan.item + '". Green: ' + green + '. Gated (tax/legal/NAV-prod): ' + gated + '. DryRun: ' + DRY_RUN + '.\n' +
    '1. First append the low-severity findings below as "- [ ]" follow-ups in docs/loop-queue.md under the right phase (commit on the branch, or on main after merge).\n' +
    (gated || !green || DRY_RUN
      ? '2. Do NOT merge or deploy. Push the branch to origin and open a pull request with `gh pr create` (title: the item; body: plan link, acceptance criteria, what green/gated means here, findings). Set docs/loop-queue.md item to "[~] needs sign-off (PR)" if gated, or leave "[~]" if not green. Return prUrl.\n'
      : '2. Ship: verify `git status --porcelain` in the main checkout is clean apart from .claude/worktrees (if not, abort and say why). `git checkout main && git pull --ff-only origin main && git merge --no-ff ' + build.branch + '`. Run npm run typecheck and npm run test:unit on main; if red, `git reset --hard origin/main` and abort. ' +
        'If the plan/build lists db/schema.ts changes: run `npm run db:push` ONLY if every change is additive (new tables/columns/indexes with defaults or nullable); if drizzle proposes any DROP/rename/data-loss statement, do NOT approve it — abort the ship, reset main, and report. ' +
        'Then `git push origin main`, then `vercel --prod --yes` and capture the deployment URL. Smoke test: curl ' + PROD_URL + '/ and ' + PROD_URL + '/login expecting HTTP 200, and run `PRODUCTION_BASE_URL=' + PROD_URL + ' npm run test:smoke:production` if it passes quickly; report smokeOk honestly. If the smoke test fails, run `vercel rollback` to the previous deployment and report.\n') +
    '3. Write docs/audits/loop/' + DATE + '-' + triage.slug + '/REPORT.md (Hungarian): item, plan link, what shipped, tests, findings fixed/deferred, deploy URL or PR URL, next suggested item. Commit it to main (or the branch if not merged) and push.\n' +
    'Low findings to append:\n' + JSON.stringify(lows, null, 1) + '\nDeferred by fixer: ' + JSON.stringify(fixResult ? fixResult.deferred : []),
  { schema: SHIP_SCHEMA, phase: 'Ship', model: 'sonnet', label: 'ship' },
)

return {
  date: DATE,
  item: plan.item,
  branch: build.branch,
  research: research ? research.itemsAdded : [],
  plan: plan.planPath,
  risk: plan.risk,
  green,
  gated,
  confirmedFindings: confirmed.length,
  fixRounds: round,
  ship,
}
