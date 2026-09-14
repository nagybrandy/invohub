export const meta = {
  name: 'app-ux-overhaul',
  description: 'Owner-priority overhaul of the signed-in app UX/UI: Opus audits the real app (desktop first, then mobile) and writes a design spec; Sonnet tracks rebuild the app shell/menu, invoice creation, lists/detail/dashboard and the visual system in worktrees; integrate; UX review + skeptic; fix; ship to production.',
  whenToUse: 'One-off (or repeatable) deep UX/UI pass on the authenticated app when the owner says the app itself is confusing or ugly. Needs E2E_TEST_EMAIL/E2E_TEST_PASSWORD in the local .env and a running/startable Expo web server.',
  phases: [
    { title: 'Audit', detail: 'Opus: log in, screenshot every screen at 1440 + 375, write docs/design/app-ux-audit-<date>.md', model: 'opus' },
    { title: 'Design', detail: 'Opus: information architecture, invoice-creation redesign, visual system, per-track briefs', model: 'opus' },
    { title: 'Build', detail: '4 Sonnet tracks in isolated worktrees, TDD', model: 'sonnet' },
    { title: 'Integrate', detail: 'Sonnet: merge tracks into ux/app-overhaul, typecheck + unit green', model: 'sonnet' },
    { title: 'Review', detail: 'Sonnet: UX desktop, UX mobile, acceptance vs spec, security — each skeptic-verified', model: 'sonnet' },
    { title: 'Fix', detail: 'Sonnet: fix confirmed high/medium findings (≤2 rounds)', model: 'sonnet' },
    { title: 'Ship', detail: 'merge → main, push, vercel --prod, smoke, report', model: 'sonnet' },
  ],
}

// Plain JS. Caller passes args.date ("YYYY-MM-DD"). Optional args.dryRun.
if (!args || typeof args.date !== 'string') throw new Error('app-ux-overhaul requires args.date "YYYY-MM-DD".')
const DATE = args.date
const DRY_RUN = !!args.dryRun
const REPO = '/Users/brandy/Developer/invohub'
const PROD_URL = 'https://invohub.vercel.app'
const INTEG = 'ux/app-overhaul-' + DATE

const RULES =
  'Repo: ' + REPO + ' — InvoHub, Hungarian invoicing app for egyéni vállalkozók (Expo Router + Gluestack v5 + NativeWind + Better Auth + Drizzle/Neon). Follow CLAUDE.md and AGENTS.md (className not RN style arrays on web, webDomProps in *.web.tsx, hu+en i18n keys for every string, tests for every change). ' +
  'A seeded test account exists: read E2E_TEST_EMAIL and E2E_TEST_PASSWORD from ' + REPO + '/.env (never print the password; never commit .env). The app is started with `npx expo start --web --port <PORT>` from a checkout; pick a free port ≥ 8100 for yourself and kill it when done. The login screen is /login; after sign-in the app lives under /dashboard, /invoices, /invoices/new, /clients, /products, /receipts, /settings. ' +
  'Owner brief (2026-09-14): "On desktop the app has a lot of UX/UI problems: invoice creation is complicated, it is hard to see what is where, the in-app menu is not clear, and it is not pretty. Fix these first." Desktop (1440×900) first, mobile (375×812) must not regress. Brand: docs/brand.md (navy #111f4a, cornflower #6495ed, green only for paid/success), Ranade for headings. ' +
  'Never touch NAV/M2M production behaviour, tax figures, or db/schema.ts in this workflow (UI/UX only, plus the hooks/API glue a screen needs). Commit with the trailer "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>" (Opus agents: "Claude Opus 5").'

const WORKTREE = (branch) =>
  'You are in a fresh git worktree. First `ln -s ' + REPO + '/node_modules node_modules` if node_modules is missing, then `git checkout -b ' + branch + '` from the current HEAD (main). Do all work and commits on that branch. Run `npm run typecheck`, `npx jest <touched>` and `npm run test:unit` before returning; fix what you broke.'

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    auditPath: { type: 'string' },
    screensDir: { type: 'string' },
    topProblems: { type: 'array', items: { type: 'string' } },
  },
  required: ['auditPath', 'screensDir', 'topProblems'],
}
const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    specPath: { type: 'string' },
    tracks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          brief: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          acceptance: { type: 'array', items: { type: 'string' } },
        },
        required: ['key', 'title', 'brief', 'acceptance'],
      },
    },
    sharedFirst: { type: 'string' },
  },
  required: ['specPath', 'tracks'],
}
const TRACK_SCHEMA = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    summary: { type: 'string' },
    typecheckPassed: { type: 'boolean' },
    testsPassed: { type: 'boolean' },
    testNotes: { type: 'string' },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['branch', 'summary', 'typecheckPassed', 'testsPassed'],
}
const INTEG_SCHEMA = {
  type: 'object',
  properties: { merged: { type: 'array', items: { type: 'string' } }, skipped: { type: 'array', items: { type: 'string' } }, typecheckGreen: { type: 'boolean' }, unitGreen: { type: 'boolean' }, notes: { type: 'string' } },
  required: ['merged', 'typecheckGreen', 'unitGreen', 'notes'],
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] }, title: { type: 'string' }, file: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'title', 'file', 'evidence', 'fix'] } },
    acceptanceMet: { type: 'boolean' },
  },
  required: ['findings'],
}
const FIX_SCHEMA = { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, deferred: { type: 'array', items: { type: 'string' } }, typecheckPassed: { type: 'boolean' }, testsPassed: { type: 'boolean' } }, required: ['fixed', 'deferred', 'typecheckPassed', 'testsPassed'] }
const SHIP_SCHEMA = { type: 'object', properties: { merged: { type: 'boolean' }, pushed: { type: 'boolean' }, deployed: { type: 'boolean' }, deployUrl: { type: 'string' }, smokeOk: { type: 'boolean' }, prUrl: { type: 'string' }, reportPath: { type: 'string' }, notes: { type: 'string' } }, required: ['merged', 'pushed', 'deployed', 'smokeOk', 'notes'] }

// ---------- Audit (Opus) ----------
phase('Audit')
const audit = await agent(
  RULES +
    '\n\nYou are the UX lead. Audit the SIGNED-IN app as a real egyéni vállalkozó would use it. Start Expo web from the main checkout on a free port, sign in with the test account (Playwright: fill /login, submit, save storageState), then screenshot EVERY app screen at 1440×900 and 375×812 into docs/design/screens/' + DATE + '/ (dashboard, invoices list, invoice detail, invoices/new — including each step of filling it in, clients, client edit, products, receipts, receipts/new, settings and every settings sub-page, onboarding if reachable). If the account has no data, load demo data via Settings → "Demo adatok" (or POST /api/dev/seed with the session cookie) so lists are realistic. ' +
    'Then write docs/design/app-ux-audit-' + DATE + '.md (Hungarian, with English headings fine): per screen — what a user is trying to do, what is confusing (hierarchy, labels, where things are), what is ugly/inconsistent (spacing, type, color, density), and concrete severity. Cover explicitly: the in-app navigation (desktop sidebar/topbar and mobile tabs — is it obvious where invoices/clients/settings are, is "Új számla" always one tap away?), invoice creation (how many fields before the first line item, what is required vs optional, defaults, live totals/preview, what happens on save/send), and overall visual quality vs docs/brand.md. Finish with a ranked "Top 10 problems" list. Commit the audit + screenshots. Kill your Expo server.',
  { schema: AUDIT_SCHEMA, phase: 'Audit', model: 'opus', label: 'audit' },
)
if (!audit) throw new Error('Audit agent returned nothing.')
log('Audit: ' + audit.auditPath + ' — top problems: ' + audit.topProblems.slice(0, 3).join(' | '))

// ---------- Design (Opus) ----------
phase('Design')
const design = await agent(
  RULES +
    '\n\nYou are the product designer. Read ' + audit.auditPath + ' and look at the screenshots in ' + audit.screensDir + '. Read the current code for the app shell (components/navigation/*, lib/app-navigation.ts, app/(app)/_layout.tsx), invoice creation (app/(app)/invoices/new.tsx, components/invoices/*, lib/invoices/build-draft-invoice.ts), lists/detail (app/(app)/invoices/*, dashboard/index.tsx, components/layout/*) and the design tokens (components/ui/gluestack-ui-provider/config.ts, global.css, tailwind.config.js, lib/theme/tokens.ts). ' +
    'Write docs/design/app-ux-spec-' + DATE + '.md — a concrete, buildable spec, not a mood board: (1) Information architecture + navigation: desktop sidebar with clear primary sections (Vezérlőpult, Számlák, Nyugták, Partnerek, Termékek, Beállítások), a persistent primary "Új számla" action, page headers with breadcrumb/title/primary action, mobile bottom tabs + FAB; (2) Invoice creation redesign: a 3-step or 2-column flow (Partner → Tételek → Ellenőrzés & küldés) with smart defaults from company settings (currency, VAT category incl. AAM, payment method, due date), required fields minimised, inline line-item editing with live nettó/ÁFA/bruttó totals, a sticky summary + preview, clear Mentés piszkozatként / Véglegesítés / Küldés actions, and the same structure reused by edit; (3) Lists/detail/dashboard: scannable invoice list (status chips, amounts right-aligned tabular, filters), invoice detail with a clear status timeline and actions, dashboard with 3–4 meaningful KPIs and "next actions"; (4) Visual system: spacing scale, type scale (Ranade headings), surfaces/borders/shadows, status colors (green only for paid), empty/loading/error state patterns, component recipes (PageHeader, Section, DataTable/List row, FormField, StatCard). ' +
    'Then split the work into exactly 4 independent Sonnet tracks that can be built in parallel worktrees with minimal file overlap: "shell" (navigation/app shell/page headers), "invoice-create" (new + edit invoice flow), "lists" (invoice list/detail, dashboard, clients/products/receipts list polish), "visual" (tokens, shared layout/ui recipes, empty/loading states). For each track give a precise brief (files to touch, files NOT to touch, acceptance criteria numbered and testable on desktop AND mobile, i18n keys needed). If a shared foundation (new PageHeader/Section components, tokens) must exist before the other tracks, describe it in sharedFirst so the visual track ships it first and the others build on the current API shape without waiting (they can import from the agreed path). Commit the spec.',
  { schema: DESIGN_SCHEMA, phase: 'Design', model: 'opus', label: 'design' },
)
if (!design || !design.tracks.length) throw new Error('Design agent returned no tracks.')
log('Spec: ' + design.specPath + ' — ' + design.tracks.length + ' tracks: ' + design.tracks.map((t) => t.key).join(', '))

// ---------- Build (Sonnet tracks, parallel worktrees) ----------
phase('Build')
const trackResults = await parallel(
  design.tracks.map((t) => () =>
    agent(
      RULES + '\n\n' + WORKTREE('ux/track-' + t.key) +
        '\n\nYour role definition is .claude/agents/implementer.md (read it). Build TRACK "' + t.title + '" from the spec ' + design.specPath + ' (read the whole spec first, then your track section). Brief: ' + t.brief + '\nFiles: ' + JSON.stringify(t.files || []) + '\nAcceptance criteria: ' + JSON.stringify(t.acceptance) +
        (design.sharedFirst ? '\nShared foundation agreed for all tracks: ' + design.sharedFirst : '') +
        '\nWork TDD: failing tests first (component render/interaction tests, hook tests, nav tests). Verify visually yourself: start Expo web on a free port ≥ 8100 from YOUR worktree, sign in with the test account, take Playwright screenshots of your screens at 1440×900 and 375×812, LOOK at them (Read tool) and iterate until it matches the spec and looks good; kill the server. Return branch, summary, test status, open issues.',
      { isolation: 'worktree', schema: TRACK_SCHEMA, phase: 'Build', model: 'sonnet', label: 'track:' + t.key },
    ),
  ),
)
const tracks = trackResults.map((r, i) => r || { branch: 'ux/track-' + design.tracks[i].key, summary: 'AGENT FAILED', typecheckPassed: false, testsPassed: false, failed: true })
tracks.forEach((t) => log(t.branch + ': ' + (t.failed ? 'FAILED' : t.testsPassed ? 'tests green' : 'tests NOT green')))

// ---------- Integrate ----------
phase('Integrate')
const integ = await agent(
  RULES +
    '\n\nYou are the INTEGRATOR in the MAIN checkout ' + REPO + '. `git status --porcelain` must be clean apart from .claude/worktrees — if not, stop and report. `git checkout main && git pull --ff-only origin main && git checkout -b ' + INTEG + '`. Merge these branches in order (skip missing ones): ' + tracks.map((t) => t.branch).join(', ') + '. Resolve conflicts preserving both intents (shared components/tokens/i18n locales will overlap). After each merge run `npm run typecheck`; at the end `npm run test:unit` must be green — fix real breakage, never delete tests. Then start Expo web on a free port, sign in with the test account, and screenshot dashboard, invoices, invoices/new, clients, settings at 1440×900 and 375×812 into docs/design/screens/' + DATE + '-integrated/ so reviewers can compare; commit them; kill the server. Track reports: ' + JSON.stringify(tracks),
  { schema: INTEG_SCHEMA, phase: 'Integrate', model: 'sonnet', label: 'integrate' },
)
if (!integ) throw new Error('Integrator returned nothing.')
log('Integrated: ' + integ.merged.join(', ') + ' (typecheck ' + integ.typecheckGreen + ', unit ' + integ.unitGreen + ')')

// ---------- Review (Sonnet, skeptic-verified) ----------
phase('Review')
const REVIEW_BASE = RULES + '\n\nYou are a READ-ONLY reviewer of branch ' + INTEG + ' (diff vs main; run the app from a temporary worktree of that branch on a free port ≥ 8100 with the test account; remove the worktree when done). Spec: ' + design.specPath + '. Audit it was meant to fix: ' + audit.auditPath + '. Report only concrete, evidenced findings (file + line or screenshot path under docs/design/screens/' + DATE + '-review/), max 15, most severe first. Set acceptanceMet honestly.'
const REVIEWS = [
  { key: 'ux-desktop', role: '.claude/agents/ux-reviewer.md', prompt: 'DESKTOP 1440×900 UX: walk the real flows — find an invoice, create a new invoice end to end (partner, 2 line items incl. an AAM line, save draft, finalize, open detail), edit company settings, use every nav item. Is it obvious where things are? Is invoice creation simple? Does it look coherent and polished? Compare against the Top 10 problems in the audit — which are fixed, which remain?' },
  { key: 'ux-mobile', role: '.claude/agents/ux-reviewer.md', prompt: 'MOBILE 375×812 UX: same flows on mobile — bottom tabs, FAB/"Új számla", the stepped invoice creation, list scanability, tap targets ≥44px, keyboard behaviour on forms, no horizontal overflow, no regressions vs before.' },
  { key: 'acceptance', prompt: 'Acceptance vs spec: for every numbered acceptance criterion of every track in the spec, state met / not met with evidence. Run npm run typecheck + npm run test:unit yourself. Check hu/en i18n parity for new keys, AGENTS.md web rules, and that tests were actually added for new behaviour.' },
  { key: 'security', role: '.claude/agents/security-reviewer.md', prompt: 'Security/compliance on the diff only: any new API route has requireSession + per-user scoping; no secrets logged/returned; NAV/M2M defaults untouched; no tax figures or compliance claims added.' },
]
const reviewed = await pipeline(
  REVIEWS,
  (r) => agent(REVIEW_BASE + (r.role ? '\n\nRole file: ' + r.role + ' (read and follow, read-only).' : '') + '\n\nDIMENSION: ' + r.prompt, { schema: FINDINGS_SCHEMA, phase: 'Review', model: 'sonnet', label: 'review:' + r.key }),
  (res, r) => {
    const findings = res && Array.isArray(res.findings) ? res.findings : []
    if (!findings.length) return { key: r.key, findings: [], acceptanceMet: res ? res.acceptanceMet : undefined }
    return agent(REVIEW_BASE + '\n\nYou are a SKEPTIC: try to refute each finding by re-checking the file/screenshot; keep only what survives and correct overstated severities.\n' + JSON.stringify(findings, null, 1), { schema: FINDINGS_SCHEMA, phase: 'Review', model: 'sonnet', label: 'verify:' + r.key })
      .then((v) => ({ key: r.key, findings: v ? v.findings : findings, acceptanceMet: res ? res.acceptanceMet : undefined }))
  },
)
const seen = new Set(); const confirmed = []
for (const r of reviewed.filter(Boolean)) for (const f of r.findings) { const k = (f.file + '|' + f.title).toLowerCase(); if (!seen.has(k)) { seen.add(k); confirmed.push(Object.assign({}, f, { dimension: r.key })) } }
let blocking = confirmed.filter((f) => f.severity !== 'low')
let green = integ.typecheckGreen && integ.unitGreen
log('Confirmed findings: ' + confirmed.length + ' (blocking: ' + blocking.length + ')')

// ---------- Fix (≤2 rounds) ----------
let round = 0; let fixResult = null
while ((blocking.length || !green) && round < 2) {
  round += 1
  phase('Fix')
  fixResult = await agent(
    RULES + '\n\nFix round ' + round + ' on branch ' + INTEG + ' — use a worktree of that branch (symlink node_modules). Fix these confirmed findings and any red typecheck/tests, staying within the spec ' + design.specPath + '. Verify visually (screenshots) for UX findings. Commit on the branch. Findings:\n' + JSON.stringify(blocking, null, 1),
    { isolation: 'worktree', schema: FIX_SCHEMA, phase: 'Fix', model: 'sonnet', label: 'fix-' + round },
  )
  if (!fixResult) break
  const recheck = await agent(REVIEW_BASE + '\n\nRe-verify ONLY these findings after fix round ' + round + '; return the ones still present:\n' + JSON.stringify(blocking, null, 1), { schema: FINDINGS_SCHEMA, phase: 'Fix', model: 'sonnet', label: 'recheck-' + round })
  blocking = recheck ? recheck.findings.filter((f) => f.severity !== 'low') : []
  green = fixResult.typecheckPassed && fixResult.testsPassed
  log('After fix round ' + round + ': ' + blocking.length + ' blocking, green=' + green)
}

// ---------- Ship ----------
phase('Ship')
const lows = confirmed.filter((f) => f.severity === 'low')
const ship = await agent(
  RULES + '\n\nSHIP agent in the MAIN checkout ' + REPO + '. Branch: ' + INTEG + '. green=' + green + ', blocking=' + blocking.length + ', dryRun=' + DRY_RUN + '.\n' +
    '1. Append the low findings and anything deferred as "- [ ]" items under Phase 1 in docs/loop-queue.md, and flip Prioritás item 0 (App UX/UI overhaul) plus the absorbed items 1/7/8 to [x] if shipped. Commit on ' + INTEG + '.\n' +
    (green && !blocking.length && !DRY_RUN
      ? '2. `git status --porcelain` clean apart from .claude/worktrees (else abort). `git checkout main && git pull --ff-only origin main && git merge --no-ff ' + INTEG + '`; run `npm run typecheck` and `npm run test:unit` on main (red → `git reset --hard origin/main`, abort, report). `git push origin main`; `vercel --prod --yes` and capture the URL; smoke: curl ' + PROD_URL + '/ and /login expect 200, then log in via Playwright against ' + PROD_URL + ' with the test account and screenshot /dashboard and /invoices/new at 1440 into docs/design/screens/' + DATE + '-prod/ (commit to main, push). If smoke fails: `vercel rollback` and report.\n'
      : '2. Do NOT merge. Push ' + INTEG + ' and open a PR with `gh pr create` (title "App UX/UI overhaul ' + DATE + '", body: spec, what is green/blocked, findings). Return prUrl.\n') +
    '3. Write docs/audits/ux-overhaul-' + DATE + '/REPORT.md (Hungarian): what changed per track, before/after screenshot paths, findings fixed/deferred, deploy URL or PR. Commit + push.\nLow findings: ' + JSON.stringify(lows, null, 1) + '\nDeferred: ' + JSON.stringify(fixResult ? fixResult.deferred : []),
  { schema: SHIP_SCHEMA, phase: 'Ship', model: 'sonnet', label: 'ship' },
)

return { date: DATE, audit: audit.auditPath, spec: design.specPath, tracks: tracks.map((t) => ({ branch: t.branch, testsPassed: t.testsPassed })), integration: integ, confirmedFindings: confirmed.length, fixRounds: round, green, ship }
