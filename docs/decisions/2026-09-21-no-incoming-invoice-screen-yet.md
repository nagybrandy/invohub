# 2026-09-21 — Remove the mislabelled dashboard button instead of building an incoming-invoices screen

## Context

The dashboard's desktop header showed a "Bejövő számlák" (incoming
invoices) button (`app/(app)/dashboard/index.tsx`, `testID`
`dashboard-incoming-invoices`) with an `Inbox` icon. It actually called
`router.push(routes.invoicesFiltered("unpaid"))` — the *outgoing* unpaid
list, i.e. invoices the user issued and is waiting to be paid on. For an
egyéni vállalkozó, "bejövő számla" means the opposite: a supplier's
invoice (költségszámla) the user owes and must book as a cost. The label
promised the wrong direction of money, and the same destination was
already reachable, correctly labelled and with more information (amount +
count), from the "Kintlévőség" KPI card.

A real incoming-invoice store already exists — `incomingInvoice` in
`db/schema.ts`, exposed by `GET /api/nav/incoming` (list) and
`GET /api/nav/incoming?sync=true` (sync). But `syncIncomingInvoices`'s
only data source, `fetchIncomingInvoices` (`lib/nav/client.ts`), is a pure
function that returns two hardcoded literal supplier invoices — no NAV
environment is ever contacted, in any mode. The route was reachable by any
authenticated user in production with a single `GET`, so any user could
have had two invented supplier invoices, with invented tax numbers and
amounts, written into their account's books. Nothing in the app called
this endpoint (only its own file, its test, and docs referenced it), which
is the only reason it had not already bitten someone.

## Decision

1. Remove the desktop `primaryAction` branch that rendered the
   mislabelled button; add no replacement (desktop already has a
   prominent "Új számla" CTA in the sidebar, so anything here would be a
   duplicate). Mobile's "Új számla" primary action is untouched.
2. Gate `GET /api/nav/incoming?sync=true` behind `isDevSeedAllowed()` —
   the same guard `app/api/dev/seed+api.ts` already uses for the demo
   seed — returning `404 { error: "Not found." }` when it's not allowed.
   `requireSession` still runs first, so an unauthenticated caller gets
   401, not 404; only the sync branch is disabled, not the whole route.
   The plain `GET /api/nav/incoming` list branch is unchanged in every
   environment.
3. **Do not build the incoming-invoices screen this round.** Its only
   possible data source today is the fabricated stub above; shipping a
   screen on top of it would show a Hungarian sole proprietor two
   fabricated supplier invoices and invite them to treat those as real
   costs — worse than the mislabelled button, not better. Nothing under
   `lib/nav/` (`incoming-sync.ts`, `client.ts`, `environment.ts`) is
   touched by this decision; the stub and the store both stay exactly as
   they are, just unreachable from production traffic.

## Consequences

- The dashboard no longer claims to show supplier invoices anywhere.
- The unpaid-invoice list keeps exactly one entry point on the dashboard
  (the KPI card), not three.
- InvoHub can no longer write invented supplier invoices into a real
  user's account; the dev/demo sync path (`isDevSeedAllowed() === true`)
  still works unchanged.
- The real incoming-invoice feature is not lost, only deferred: a queue
  item (`docs/loop-queue.md`) records that it needs NAV OSA
  `queryInvoiceDigest` (`invoiceDirection: INBOUND`) + `queryInvoiceData`
  against the **test** environment, XML→row mapping, pagination, and/or a
  manual cost-invoice entry form, before a screen and nav entry make
  sense. Cost-side invoices are primarily a Phase 3 (EV tax /
  költségelszámolás) input, so building the surface now would be building
  ahead of the phase.
