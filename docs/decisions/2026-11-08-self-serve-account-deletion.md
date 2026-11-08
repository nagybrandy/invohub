# 2026-11-08 — Self-serve account deletion request (PROPOSAL, gated OFF)

Status: **proposal — awaiting owner + legal sign-off.** Tax/legal-gated per
CLAUDE.md: do not auto-merge. Builds on, and does not change,
[2026-09-22 — Account deletion = account closure](2026-09-22-invoice-retention-on-account-deletion.md)
(accepted): the `user` row is never hard-deleted, issued invoices are kept
under the engineering default of 8 years from the end of the issue year, the
FK migration and the purge job stay proposals.

Every classification below that is a legal judgement is marked
**LEGAL: confirm**. Nothing here is legal advice, and the 8-year figure is
the ADR's conservative engineering default, not a lawyer's number.

## What exists today (verified 2026-11-08)

- **Data export already exists** — the *Adatexport* screen
  (`app/(app)/export/index.tsx`, route `routes.dataExport` = `/export`,
  menu entry in `lib/app-navigation.ts`). It downloads CSV for four
  datasets — invoices, receipts, clients, products — with date/status/search
  filters (`lib/export/datasets.ts`, built on `lib/export/csv.ts`). Separate
  from it: the NAV-format tax-audit export of issued invoices
  (`components/settings/TaxAuditExportCard.tsx`, Beállítások → NAV) and the
  admin-only retained-records JSON (`GET /api/admin/users/:id/export`,
  `lib/account/export.ts`). This proposal does **not** rebuild export; the
  deletion screen links to Adatexport first.
  Gap to flag: Adatexport has no company-data, incoming-invoice or
  NAV-submission dataset and no single "everything" bundle. Whether the
  existing CSV datasets satisfy the data-portability right (GDPR Art. 20) is
  **LEGAL: confirm**; if not, add datasets (out of scope here).
- **Closure engine exists, admin-only** — `lib/account/closure.ts`
  (`closeAccount`), reachable only via `POST /api/admin/users/:id/close`.
  The self-serve flow below must end up calling the *same* function, so
  there is one definition of "what closure does".
- **Better Auth `deleteUser` is disabled** and any user-row delete is
  blocked (`lib/auth.ts`; asserted in `lib/account/no-hard-delete.test.ts`).

## Data classification (per table in `db/schema.ts`)

Matches what `closeAccount` already does, extended to the tables the earlier
ADR did not discuss. Encoded as data in `lib/account/deletion-plan.ts`
(`ACCOUNT_DATA_CLASSIFICATION`) with a test that fails when a new table is
added without a decision.

| Table | Decision | Notes |
|---|---|---|
| `invoice` (non-draft, incl. storno / helyesbítő) | **RETAIN** — LEGAL: confirm | Issued invoices; the period is the ADR's 8-year default. |
| `invoice` (draft) | DELETE | Not an issued document. LEGAL: confirm that proforma/draft rows carry no duty. |
| `invoice_line_item` | RETAIN (issued) / DELETE (draft, cascade) | Needed to reproduce the invoice. |
| `nav_submission` | RETAIN — LEGAL: confirm | Transaction ids / NAV answers for issued invoices. |
| `receipt`, `receipt_line_item` | RETAIN — LEGAL: confirm | Nyugta. |
| `nav_receipt_submission` | RETAIN — LEGAL: confirm | Daily NAV receipt reports. |
| `incoming_invoice` | RETAIN — LEGAL: confirm | Received (cost) invoices support the user's own books; the user may need them for their tax filing. Could instead be exported-then-deleted; lawyer to decide. |
| `company` | RETAIN seller data; ANONYMISE secrets | Seller name/tax number/address are printed on retained invoices. NAV technical user, password, XML sign/change keys and invoice e-mail To/Cc are wiped (no legal need). |
| `client` | RETAIN if referenced by a retained invoice, else DELETE; ANONYMISE the retained ones | Buyer e-mail is cleared (not printed on invoices). Buyer name/address are kept as printed. LEGAL: confirm that buyer data on retained invoices is covered. |
| `document_sequence` | RETAIN — LEGAL: confirm | Numbering continuity evidence. |
| `invoice_pdf_template` | RETAIN | Appearance of issued documents (frozen snapshot on the invoice also exists). |
| `user` | **ANONYMISE** | e-mail → `closed-<id>@invalid`, name → "Closed account", image null, `closed_at` / `retention_until` set. Row stays (FK anchor for retained rows). |
| `account` (password hash, OAuth tokens) | DELETE | Login becomes impossible. |
| `session`, `verification` | DELETE | |
| `api_key`, `idempotency_key` | DELETE | |
| `notification`, `email_template`, `payment_reminder_schedule`, `product` | DELETE | Line items snapshot description/price/VAT. |
| `workspace_access`, `workspace_invite` | DELETE | Grants into and out of the account; invites addressed to the closed login are personal data. |
| `account_deletion_request` (new) | RETAIN | The record that the user asked, and when — proof for the user and for us. Contains no personal data beyond ids and an optional free-text reason. LEGAL: confirm retention period. |
| `exchange_rate`, `company_directory` | NOT ACCOUNT DATA | Shared public data, untouched. |
| Rate limiting | NOT A TABLE | In-memory buckets, nothing persisted. |

Logs outside the database (Vercel runtime logs, e-mail provider logs) are a
separate question for the privacy review — **LEGAL: confirm**.

## Who may request what

The table is keyed by *billing account* so the model can grow, but the first
version only supports the simplest case:

| Situation | Proposal |
|---|---|
| A person closes their **own** account (no members) | Supported by the gated flow. Request is made by the signed-in person (`requireActor`), never via a delegated/selected account. |
| A person who **owns workspaces** | Blocked until each workspace is closed or ownership is handed over — never close someone else's company silently. Not implemented; the status API will report `blockedBy: workspaces` once implemented. |
| A **member / admin / accountant / viewer** of someone else's account | Cannot request closure of that account. What they may do is leave it (`POST /api/workspaces/leave`, exists). Closing their *own* person account removes their grants (closure already deletes `workspace_access`). |
| A **workspace** itself | Only its owner, as a separate request for that billing account, with a notice to members and the same grace period. Not in this PR. |
| **Accountants** (external) | Their own account is a person account — same flow. Data they exported from clients' accounts is outside InvoHub. Clients keep their data; only the accountant's access row goes. |

## Flow

1. **Export first.** The Beállítások section opens with a link to Adatexport
   and states plainly what is kept. Not a hard gate (the user may decline),
   but the export button is the first action.
2. **Request.** Confirm dialog (typed confirmation optional, **LEGAL: confirm**
   copy) → `POST /api/account/deletion` creates one `requested` row with
   `scheduled_for = requested_at + 30 days` (grace period; the length is a
   **product proposal**, not a legal figure). The account keeps working
   during the grace period.
3. **Cancel.** `DELETE /api/account/deletion` while `requested` →
   `cancelled`. Signing in during the grace period shows the pending request.
4. **Closure** (NOT built here). After `scheduled_for` a separate job would
   re-check preconditions (no open NAV procedure, no owned workspaces) and
   run the existing `closeAccount`, then mark the request `completed`. That
   step needs its own PR, its own sign-off, and an explicit off switch.
5. **Afterwards.** The user cannot sign in. Retained documents are kept
   read-only and are not visible in any account UI; they are handed over as an
   export on request to support (the admin export endpoint), until a purge
   after the retention date (the earlier ADR's `TODO(retention-purge)` — a
   separate job, out of scope here).
6. **Audit trail.** The request row records who/when (`requested_at`,
   `cancelled_at`, later `completed_at`). A dedicated append-only audit log
   does not exist in the schema; whether one is needed for erasure requests
   is a question for the privacy review. Do not log the free-text reason
   anywhere else.

## What the code in this PR does (and does not)

- Feature flag `ACCOUNT_DELETION_ENABLED` (server, default **off**) and
  `EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED` (UI twin, default **off**). Off:
  the routes return 404 and the Beállítások section is not rendered.
- Additive table `account_deletion_request` (migration `0016`; PRs
  #105/#109/#111/#112 also add a `0016` — whichever merges later must be
  renumbered and its `meta/_journal.json` entry fixed).
- Request / cancel / status API, scoped to the signed-in person.
- `planAccountClosure()` — a **pure** function that returns which rows would
  be deleted / anonymised / retained, for display and review. No DB access,
  not imported by any route, job or cron (a test asserts this).
- **Not built:** any executable closure from the self-serve path, any cron,
  the purge job, workspace-owner closure, any change to `deleteUser`.

## Questions for the lawyer / owner

1. Is "8 years from the end of the issue year for everyone" acceptable, or
   should EV users get the shorter Art. period? (inherited from the earlier ADR)
2. May **incoming invoices** be deleted (after export) or must they be kept?
3. May **drafts / proformas** be deleted at closure?
4. Buyer data on retained invoices and on referenced `client` rows: kept
   as printed — confirm; and confirm clearing buyer e-mail is fine.
5. How long may we keep the `account_deletion_request` row, and may the
   reason text be stored at all?
6. Is a 30-day grace period acceptable against GDPR's one-month response
   time for erasure requests (Art. 12(3)), or must closure happen sooner /
   the request be acknowledged and *actioned* within the month?
7. Is the existing Adatexport (CSV: invoices, receipts, clients, products)
   enough for data portability, or must company, incoming invoices and NAV
   submissions be added?
8. Wording of the user-facing notice (what is kept and why) — the hu/en copy
   in this PR avoids statute numbers on purpose and needs approval.
9. Logs and backups outside the database: retention and erasure stance.
10. Owner questions: grace period length; whether workspace owners with
    members may self-serve at all; whether closure should be blocked while an
    invoice is unpaid or a NAV submission is pending.
