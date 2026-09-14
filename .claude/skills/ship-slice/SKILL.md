---
name: ship-slice
description: Use to ship one backlog item from docs/loop-queue.md end to end — pick the top unchecked item in phase order, branch, write a failing test first, implement the smallest change, run typecheck/unit/relevant e2e, update the checklist, commit. Used by the implementer agent and the ship-next workflow.
---

# Ship one slice

## 1. Pick the item

Open `docs/loop-queue.md`. Pick the **first unchecked (`[ ]`) item**, in
phase order (Phase 0 → 1 → 2 → 3 → 4) — do not skip ahead to a later phase
because it looks more interesting. Skip an item only if:
- It's already marked `[~] folyamatban (claude/platform-overhaul)` by
  someone else (in progress elsewhere), or
- It's explicitly tagged as needing tax/legal human sign-off and you have
  no such sign-off available — in that case do the scaffolding/tests only,
  per the implementer agent's constraints, and say so in the PR
  description rather than silently completing it.

## 2. Branch

```
git checkout -b slice/<short-kebab-slug-of-the-item>
```

Branch off whatever the current base is (do not assume `main` if you were
told to work from a different base).

## 3. Write a failing test first

Before writing any implementation:
- `lib/` change → `*.test.ts` next to the file
- `hooks/` change → `*.test.tsx`, mock `apiFetch` (see existing hook tests
  for the pattern)
- `components/` change with non-trivial behavior → render/interaction test
- New route → extend `lib/navigation.test.ts` / `lib/app-navigation.test.ts`

Run it and confirm it **fails** for the right reason before implementing.

## 4. Implement the smallest change

Follow AGENTS.md rules (className not style arrays on web, `webDomProps()`
in `*.web.tsx`, early-return for empty FlatList states). Add i18n keys to
**both** `lib/i18n/locales/hu.ts` and `lib/i18n/locales/en.ts` for any new
user-facing string.

If the item touches `db/schema.ts`: edit the schema file and run
`npx drizzle-kit generate --name <slug>` to record the migration. Do **not**
run `npm run db:push` yourself — the dev-loop's Ship phase applies additive
changes to the live database after review; destructive changes (DROP,
rename, data loss) are never auto-applied. List the schema change
explicitly (ADDITIVE / DESTRUCTIVE) in your result.

## 5. Verify

```
npm run typecheck
npx jest <touched test paths>
npm run test:unit
```

Add the relevant Playwright spec only if the item is UI-visible and an
e2e-worthy flow already has a spec file to extend — don't invent new e2e
infra for a single slice.

## 6. Update the backlog

In `docs/loop-queue.md`, flip the item's checkbox to `[x]`. If the item
turned out to need a follow-up you didn't do, add a new `[ ]` sub-item
under it rather than leaving it half-described.

## 7. Commit

One commit (or a small stack) with a clear message describing the slice.
Do not merge. Do not push to any remote.

## PR description template

```
## What
<one-line summary>

## Backlog item
docs/loop-queue.md → <phase> → <item text>

## Tests
- <new/changed test file>: <what it asserts>

## Schema changes
<list db/schema.ts changes, or "none">

## Follow-ups noticed (not fixed here)
<bullet list, or "none">
```
