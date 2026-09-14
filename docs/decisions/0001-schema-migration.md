# 0001 — First drizzle-kit migration (platform overhaul)

## Context

No `drizzle/` migrations directory has ever existed in this repository's
git history. The schema (`db/schema.ts`) was presumably kept in sync with
the live Neon database via `drizzle-kit push` (`npm run db:push`), not
via tracked migration files.

This integration branch (`claude/platform-overhaul`) merges five feature
branches, three of which change `db/schema.ts`:

- **claude/track-invoicing** — VAT categories per line, atomic invoice
  numbering (`document_sequence` table), payment fields, storno/helyesbítő
  linking, `company.vatExempt`.
- **claude/track-nav** — `company.navXmlChangeKey`, `nav_submission.mode`
  / `.messages` / `.checkedAt`.
- **claude/track-claude-infra** / **cursor/bank-match-core** — no schema
  changes (bank-matching logic only, no persisted table yet).

Per the hard rule for this task, no `db:push` was run and no live
database was touched or even reachable from this sandbox (no
`DATABASE_URL`, no `.env`).

## What was generated

```
npx drizzle-kit generate --name platform_overhaul
```

ran successfully **without** a `DATABASE_URL` (schema-diffing against
`drizzle/meta` snapshots doesn't need a live connection) and produced:

- `drizzle/0000_platform_overhaul.sql`
- `drizzle/meta/0000_snapshot.json`
- `drizzle/meta/_journal.json`

## Important caveat: this is a full-schema baseline, not an incremental diff

Because no prior migration existed, drizzle-kit could not compute "just
what changed in this session" — `0000_platform_overhaul.sql` is a
`CREATE TABLE` for **all 20 tables** in the current schema, i.e. the
entire database as of this branch, not only the invoicing/nav additions
listed above.

**Before running this migration against any database that already has
these tables** (e.g. a Neon DB previously synced via `db:push`), the
owner must choose one of:

1. **Fresh/empty database** (new dev or preview DB): run the migration
   normally — `drizzle-kit migrate` (or apply the SQL directly) will
   create everything from scratch.
2. **Existing database with these tables already present** (the likely
   case for production/staging, since this project used `db:push`
   before): do **not** run `0000_platform_overhaul.sql` as-is — it would
   fail on `CREATE TABLE "user"` etc. for tables that already exist.
   Instead, baseline it: mark migration `0000` as already applied in
   drizzle's internal migrations table (see drizzle-kit docs on
   "baselining an existing database") without executing its SQL, then
   generate a *second*, genuinely incremental migration (a fresh
   `db:generate` run once `0000` is marked as applied) containing only
   the new columns/tables/indexes actually needed:
   - `company.nav_xml_change_key`, `.vat_exempt`
   - `nav_submission.mode`, `.messages`, `.checked_at`
   - `invoice.document_type`, `.exchange_rate`, `.payment_method`,
     `.paid_at`, `.paid_amount`, `.original_invoice_id`,
     `.modifies_invoice_id`, `.modification_index`, plus its default
     change on `invoice_number` (not-null-default-`''`) and `currency`
     (default `'HUF'`)
   - `invoice_line_item.vat_category`, `.vat_exemption_reason`
   - new table `document_sequence`
   - new indexes `invoice_original_invoice_id_idx`,
     `invoice_modifies_invoice_id_idx`, and the partial unique index
     `invoice_user_number_unique_idx` on
     `(user_id, invoice_number) WHERE invoice_number <> ''`

This repo has never run migrations before, so the owner is best placed
to know which of these two situations actually applies to each
environment (dev/preview/production). Never run `db:push` or a
migration against a live database from an automated session without a
human confirming which path applies first.
