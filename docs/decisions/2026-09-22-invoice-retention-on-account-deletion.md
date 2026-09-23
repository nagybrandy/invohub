# 2026-09-22 — Account deletion = account closure; issued invoices are retained for 8 years

Status: accepted for the app-level guard; **FK migration and the purge job
are proposals awaiting owner + legal sign-off.** Tax/legal-gated per
CLAUDE.md — do not auto-merge.

## Context

### Legal retention duty (verified 2026-09-22)

| Source | Rule | Applies to |
|---|---|---|
| Áfa tv. (2007. évi CXXVII.) **179. § (1)** | The issuer must keep issued invoices (and documents in its possession) at least until the right to assess the tax lapses ("az adó megállapításához való jog elévüléséig"). | Every VAT-law taxpayer, incl. alanyi adómentes EVs issuing invoices |
| Art. (2017. évi CL.) **202. § (1)** | The right to assess tax lapses 5 years after the last day of the calendar year in which the return / data supply was due. Suspension/interruption can extend it. | Everyone |
| Art. **78. § (3)** | Records and documents must be kept until the right to assess the tax lapses. | Everyone |
| Számv. tv. (2000. évi C.) **169. § (2)** | Documents that directly or indirectly support the accounts must be kept in readable form for "legalább 8 évig". | Entities under Számv. tv. — **not egyéni vállalkozók** (2. § (3) excludes them) |
| GDPR **Art. 17(3)(b)** | Erasure does not apply where processing is necessary for compliance with a legal obligation. | Us, as controller of the account data |

Sources: net.jogtar.hu (Számv. tv. docid a0000100.tv — 2. § (3) scope
exclusion confirmed; Áfa tv. a0700127.tv; Art. a1700150.tv). The 169. §
(2), 179. § (1) and 202. § (1) wording above was confirmed via secondary
sources (Adó Online, adozona.hu, billingo.hu) because the Jogtár page was
truncated for the fetcher. **A Hungarian lawyer/tax professional must
confirm before launch.**

**Why 8 years for everyone:** InvoHub targets EVs (5-year Art. elévülés,
counted from the end of the year the return is due — i.e. ~6 years from
the end of the issue year) but also has Kft./Bt. users (Számv. tv.: 8
years). 8 years from the end of the issue year is a superset of both and
covers the common elévülés extensions. It is a conservative engineering
choice, not legal advice.

### Audit — what an account deletion would have destroyed before this change

There was **no** account-deletion endpoint or screen (settings has none;
the admin panel only changes roles), and Better Auth's `/delete-user` was
disabled by default (`user.deleteUser` unset → 404). But nothing *enforced*
that, and the schema makes any user delete catastrophic. A `DELETE FROM
"user"` — e.g. someone flipping `deleteUser.enabled`, an admin plugin
`removeUser`, or a manual Neon console delete — cascades to:

| Table | Via | Lost |
|---|---|---|
| `invoice` | `user_id` ON DELETE CASCADE | **every issued invoice** (incl. storno/helyesbítő chains) |
| `invoice_line_item` | `invoice_id` CASCADE | all line items (amounts, VAT, AAM/TAM reasons) |
| `nav_submission` | `invoice_id` CASCADE | NAV transaction ids / receipts of submission |
| `company` | `user_id` CASCADE | seller name, tax number, address, bank account |
| `client` | `user_id` CASCADE | buyer address fallback for pre-snapshot invoices |
| `receipt`, `receipt_line_item` | CASCADE | every nyugta |
| `nav_receipt_submission` | CASCADE | daily NAV receipt reports |
| `incoming_invoice` | CASCADE | received (cost) invoices |
| `document_sequence` | CASCADE | numbering state (continuity evidence) |
| `payment_reminder_schedule`, `invoice_pdf_template`, `email_template`, `notification`, `api_key`, `idempotency_key`, `session`, `account`, `product` | CASCADE | (not legally required) |

Other deletion paths found:

- `lib/seed/demo-data.ts` `seedDemoData` deletes **all** invoices (issued
  too), NAV submissions, receipts, company etc. for the calling user. Gated
  by `lib/dev/seed-guard.ts` (needs `ALLOW_DEV_SEED=true` and not
  production) — acceptable for dev, but it is a hard-delete of issued
  documents if the guard is ever misconfigured.
- `DELETE /api/invoices/:id` and `DELETE /api/v1/invoices/:id` are
  draft-only (`deleteDraftInvoiceById`). `deleteInvoiceById` (unguarded)
  is still exported from `lib/invoices/service.ts`.
- `DELETE /api/clients/:id` / `/api/v1/clients/:id` delete a client even
  when issued invoices reference it; `invoice.client_id` is ON DELETE SET
  NULL, so invoices issued before the buyer-address snapshot columns lose
  their only buyer-address source.
- `invoice.company_id` is ON DELETE SET NULL — a company delete would
  detach seller data from issued invoices (no company DELETE route exists
  today).

## Decision

1. **The `user` row is never hard-deleted.**
   - `lib/auth.ts`: `user.deleteUser = { enabled: false, beforeDelete:
     blockUserHardDelete }` and `databaseHooks.user.delete.before =
     blockUserHardDelete` (throws `UserHardDeleteBlockedError`) — covers
     `/delete-user`, its callback and any plugin going through the adapter.
   - `lib/account/no-hard-delete.test.ts` fails the build if any source
     file under app/lib/hooks/components/scripts/db contains a user-row
     delete (`db.delete(user)`, raw `DELETE FROM "user"`,
     `internalAdapter.deleteUser`, `auth.api.deleteUser/removeUser`).
2. **Account deletion = account closure** (`lib/account/closure.ts`,
   `closeAccount`), one neon-http batch (single transaction):
   - deletes: draft invoices (their line items / NAV rows / reminders
     cascade), payment reminder schedules, API keys, sessions, `account`
     rows (password hash, OAuth tokens), verification rows, idempotency
     keys, e-mail templates, notifications, products, clients not
     referenced by any retained invoice;
   - wipes: company NAV technical user / password / XML sign + change keys,
     invoice e-mail To/Cc prefs, buyer e-mail on retained clients;
   - anonymizes the user: `email → closed-<id>@invalid`, `name → "Closed
     account"`, `image → null`, `emailVerified → false`;
   - stamps `user.closed_at` and `user.retention_until` (31 Dec of the 8th
     year after max(latest issued invoice/receipt year, closure year)).
   - **keeps**: every non-draft invoice + line items + `nav_submission`,
     `company` seller data, referenced clients, receipts + line items +
     `nav_receipt_submission`, incoming invoices, document sequences, the
     PDF template.
   - Sign-in is impossible afterwards (no credential row, unknown e-mail),
     and `databaseHooks.session.create.before` refuses a session for a
     closed user as a backstop.
3. **Admin API** (admin role only):
   - `POST /api/admin/users/:id/close` with `{ "confirm": true }` — admins
     cannot close their own account; idempotent (`already_closed`).
   - `GET /api/admin/users/:id/export` — JSON attachment of the retained
     records (issued invoices + line items, NAV submissions, receipts +
     items, NAV receipt submissions, seller company data without NAV
     secrets) to hand over on request.
4. **Schema:** additive only — `user.closed_at`, `user.retention_until`
   (nullable timestamps), migration `drizzle/0008_account-closure-retention.sql`.
5. **No UI change:** there is no delete-account screen, so none was added.
   Closure is admin-operated (erasure requests via support) until the
   self-serve flow in `docs/loop-queue.md` is built with legal copy.

## Not done — needs sign-off

### TODO(retention-purge)

A scheduled job that, per document, deletes retained rows once 8 years
from the end of their issue year have passed, and deletes the anonymized
user row (and company) once nothing retained remains. Must be designed with
the lawyer (elévülés suspension, ongoing audits/litigation holds) and must
never run against a user with an open NAV/tax procedure. Deliberately not
implemented.

### Proposed FK migration (recommendation — DROP/ADD CONSTRAINT, owner sign-off required)

Make the database itself refuse to destroy retained documents, instead of
relying only on app-level guards. Invoice → line item / NAV submission
cascades stay (the app only ever deletes drafts, which rely on them).

```sql
BEGIN;
-- user → retained documents: RESTRICT (a user delete now errors instead of wiping invoices)
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_user_id_user_id_fk",
  ADD CONSTRAINT "invoice_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "company" DROP CONSTRAINT "company_user_id_user_id_fk",
  ADD CONSTRAINT "company_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "client" DROP CONSTRAINT "client_user_id_user_id_fk",
  ADD CONSTRAINT "client_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "receipt" DROP CONSTRAINT "receipt_user_id_user_id_fk",
  ADD CONSTRAINT "receipt_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "nav_receipt_submission" DROP CONSTRAINT "nav_receipt_submission_user_id_user_id_fk",
  ADD CONSTRAINT "nav_receipt_submission_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "incoming_invoice" DROP CONSTRAINT "incoming_invoice_user_id_user_id_fk",
  ADD CONSTRAINT "incoming_invoice_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "document_sequence" DROP CONSTRAINT "document_sequence_user_id_user_id_fk",
  ADD CONSTRAINT "document_sequence_user_id_user_id_fk" FOREIGN KEY ("user_id")
  REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
-- invoice → seller / buyer rows: RESTRICT instead of SET NULL (don't detach
-- seller/buyer data from an issued invoice). NOTE: this also blocks deleting
-- a client referenced by a DRAFT; the client DELETE routes would need to
-- return 409 "in use" (they currently rely on SET NULL).
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_company_id_company_id_fk",
  ADD CONSTRAINT "invoice_company_id_company_id_fk" FOREIGN KEY ("company_id")
  REFERENCES "public"."company"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "invoice" DROP CONSTRAINT "invoice_client_id_client_id_fk",
  ADD CONSTRAINT "invoice_client_id_client_id_fk" FOREIGN KEY ("client_id")
  REFERENCES "public"."client"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
COMMIT;
```

Constraint names match the existing drizzle migrations; verify with
`\d invoice` on Neon before running. The matching `db/schema.ts` change is
`onDelete: "restrict"` on the same references. Sessions, accounts, API
keys, templates, notifications, products, idempotency keys can keep
CASCADE.

## Consequences

- An erasure request is answered by closure + an Art. 17(3)(b) notice that
  invoices are kept until `retention_until`; the notice text itself needs
  legal wording (the ÁSZF/adatkezelési drafts in `lib/legal-content.ts`
  are still placeholders).
- The closed user's `company` name/tax number still appears in admin stats
  and `/api/admin/users`, now with `closedAt` set.
- Until the FK migration ships, the app-level guards are the only barrier;
  a manual SQL delete in the Neon console would still cascade.
