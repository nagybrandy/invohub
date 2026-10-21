# Billing accounts and roles

Date: 2026-10-21 · Status: shipped (PR #93), security review requested

## Context
Owner spec: one login must be able to manage several separate billing accounts
(own company, a client's company) and an accountant must be invitable into an
account with a limited role.

## Decision
A billing account ("workspace") is a **user row that cannot sign in**
(`user.kind = 'workspace'`, no credential account). Every business table is
already keyed by user id, so no table or route had to change. A person reaches
an account through `workspace_access (account_user_id, grantee_user_id, role)`;
the account's own person needs no row (implicit owner).

`requireSession` (lib/api/session.ts) reads the selection (header
`x-invohub-account`, else cookie `invohub_account`), verifies access on **every
request** (`getAccountRole`), enforces the role centrally
(`canPerform(role, method, path)`), and returns the session with
`user.id = accountId`. A forged, malformed or revoked selection yields 401 — it
never falls back to the person's own data. `/api/admin/*` acts on the person
whatever is selected. `requireActor` ignores the selection (account management).

Roles: **owner** (everything) · **admin** (everything, can manage access, cannot
change the owner) · **accountant** (data work + export + NAV submission; no
company profile/NAV credentials, API keys, access) · **viewer** (read-only).

Invitations: `workspace_invite`, token = 32 random bytes (base64url), only the
SHA-256 stored, 14-day expiry, addressed to **one e-mail** — only a login with
that address can accept; a new invite for the same address replaces the old
one; the link is e-mailed and also returned to the inviting admin.

## Security review (2026-10-21, read-only agent) — what changed because of it
- HIGH fixed: the router accepts `/api/companies/`; the `$`-anchored deny rules did not, so an accountant could write the company profile / NAV credentials. Paths are now normalised (trailing and doubled slashes, case, percent-encoding) before matching, **and** an accountant's writes are an allowlist of data routes (a new route is closed to them by default). `GET /api/nav/check` (a live NAV token exchange) is owner/admin only.
- Tab desync fixed: `apiFetch` always sends the account (`self` for the own account), so a request can never fall back to the cookie another tab set; the in-memory selection follows the `storage` event. A malformed cookie no longer 500s every request.
- Invitations: accepted by one atomic conditional UPDATE (no double-accept race); re-checks that the inviter still has owner/admin rights and the account is open; only the owner can invite/promote/demote/remove an administrator; ≤ 20 pending per account (invite e-mail is not a mail relay); the link uses the configured app address (`BETTER_AUTH_URL`), not the request's Host.
- Workspace e-mails reply to the account owner (not the `.invalid` placeholder); account closure removes access rows and invitations; the platform admin list shows persons only.

Residual / accepted: e-mail address binding relies on the invitee's login e-mail — the product has no e-mail verification yet, so a leaked invite link for an address that never registered could be claimed by whoever registers it first (mitigated by 256-bit tokens, 14-day expiry, revocation); role denial answers 401 rather than 403; `createWorkspace` is not one transaction; no actor audit log.

## Consequences / not done
- Native apps do not persist the selection yet (web only).
- No per-account audit log of *who* (actor) did what — `session.scope.actorId`
  is available for it.
- Closing a workspace (retention rules, lib/account/closure.ts) is not
  implemented; workspaces cannot be deleted from the UI.
- The platform admin user list still shows workspace rows (kind = 'workspace').
- Invoice numbering is per account (the sequence is keyed by user id), so a new
  account starts its own series — the prefix setting (settings → Számlázási
  beállítások) is per account too.
