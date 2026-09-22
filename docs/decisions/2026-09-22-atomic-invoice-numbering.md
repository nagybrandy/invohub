# ADR: Atomic invoice numbering via a neon-serverless transaction

- **Date:** 2026-09-22
- **Status:** Accepted (needs a check against a real Neon database before merge; see "Verification")
- **Scope:** `db/transaction.ts`, `lib/invoices/service.ts` (`upsertInvoice`), `lib/invoices/numbering.ts`

## Context

23/2014. NGM rendelet 8. § (1) a) requires invoice numbers that are
continuous and never repeat. `upsertInvoice` used to allocate the number
(an `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `document_sequence`) and
then write the invoice row and its line items as separate HTTP requests over
`drizzle-orm/neon-http`. A failure between those steps (a DB error, a
function timeout, a dropped connection) used up the number and left a gap
that nothing recorded. Two concurrent finalizations of the *same* draft
could also both take a number: the second overwrote the first, which left a
gap and could cause two NAV reports.

`neon-http` does not support interactive transactions. `db.batch([...])`
runs its statements in one transaction, but they are all fixed before it
runs, so no statement can depend on an earlier statement's result.

## Options considered

1. **`db.batch` over HTTP.** The number can be computed in SQL. The
   `UPDATE invoice SET invoice_number = (SELECT … FROM document_sequence …)`
   can read the row that the earlier upsert in the same transaction locked.
   The weak spot is the "already finalized by someone else?" check. Under
   READ COMMITTED it needs a `SELECT … FOR UPDATE` in one statement and the
   check in a later one. To abort, the check would need a trick such as a
   deliberate cast error, or every later statement (including the line-item
   inserts) would need an `INSERT … SELECT … WHERE EXISTS` guard. That SQL is
   hard to read and hard to review.
2. **One CTE statement.** Same problems as option 1, and it can't cleanly
   replace a variable number of line items.
3. **Interactive transaction over the WebSocket `neon-serverless` driver,
   used only for this operation.** This gives a real session: row locks,
   checks in JS that roll back by throwing, and plain drizzle queries.

## Decision

Option 3. `db/transaction.ts` exports `runInTransaction(fn)`. Each call
creates a `Pool` from `@neondatabase/serverless` (already a dependency),
runs `drizzle(pool).transaction(fn)`, and always calls `pool.end()`, because
Neon's serverless guidance is that a Pool must not outlive the request.
Everything else still uses `db` over neon-http.

`upsertInvoice` now works as follows when a save assigns a number (status
leaves `draft` and there is no number yet):

1. **Before the transaction:** the finalized-lock check (the stored row is
   not already issued and numbered) and the company-profile check. Callers
   already check the buyer address and autofill the exchange rate before
   they call `upsertInvoice`.
2. **Inside one transaction:** `SELECT … FOR UPDATE` on the invoice row, and
   a re-check that no concurrent request finalized it (if one did, throw
   `InvoiceAlreadyFinalizedError`, which rolls back with no number taken).
   Then the `document_sequence` upsert, which keeps the row locked until
   COMMIT, so concurrent finalizations in a series wait for each other and
   get consecutive numbers. Then the invoice row with its number and status,
   the deletion of old line items, and the insert of the new ones.
3. **After COMMIT:** callers run NAV auto-submit. It is never inside the
   transaction.

Saves that don't assign a number (drafts, mark-paid, the exchange-rate fix
on an already-numbered invoice) never open a transaction.

## Consequences

- A failed finalize, whatever the cause, leaves the counter unchanged and the
  draft as it was. The next finalize gets the number that was freed.
- When two requests finalize the same draft at once, one wins. The other
  gets `InvoiceAlreadyFinalizedError`: 409 `invoiceFinalized` from the
  routes, `not_draft` from `finalizeInvoice` and
  `updateDraftInvoiceFromPayload`, and code `invoiceFinalized` from
  finalize-on-send. The losing request does not report to NAV.
- **Infra:** the finalize path now opens an outbound WebSocket to Neon. It
  relies on Node 22's global `WebSocket` (`package.json` engines `22.x`,
  which is the Vercel runtime). No `ws` package or new environment variable
  is needed; it uses the same `DATABASE_URL`. Each finalize costs one extra
  connection handshake, roughly tens of milliseconds.
- `createStornoInvoice` still sets the original invoice to `cancelled` in a
  separate write after the storno is committed. That write doesn't affect
  numbering, but it isn't atomic with the storno. This is a follow-up.

## Verification

Unit tests (`lib/invoices/atomic-numbering.test.ts`) use an in-memory fake
of transaction and row-lock behaviour. They cover rollback, running the
checks before the transaction, and the concurrency paths. No test in this
repo talks to a live Postgres. Before merging, finalize at least one invoice
against a Neon branch database. This confirms the WebSocket connection
works from the deployed Expo server bundle.
