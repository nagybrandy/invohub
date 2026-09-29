# NAV / M2M credential security review — 2026-09-22

Branch: `slice/nav-credential-hardening` (base: `slice/nav-submission-and-xml-fixes` / PR #31 + `main`).
Scope: how per-user NAV Online Számla technical-user credentials (login, password,
XML signing key, XML exchange key, tax number) and M2M credentials are stored, read,
exposed and access-controlled, before real users arrive.

> **Sign-off:** this touches `lib/nav/` credential handling and `app/api/m2m/`. Per
> CLAUDE.md it goes to a PR for human review — not auto-merged.

## 1. Inventory — where the secrets live

| Where | What |
|---|---|
| `db/schema.ts` → `company.nav_technical_user` | login (not secret-grade, shown in settings) |
| `company.nav_technical_password`, `nav_xml_sign_key`, `nav_xml_change_key` | encrypted at rest (AES-256-GCM) |
| `company.tax_number` | public data (printed on every invoice) |
| `lib/nav/credentials.ts` | encryption/decryption, key ring, masking |
| `lib/companies/service.ts` | the only writer (`upsertCompany`) + `Company` read model |
| `lib/companies/public-company.ts` | redaction for API responses (`toPublicCompany`) |
| `lib/nav/resolve-credentials.ts` | builds real NAV credentials; decrypts (`openCompanyNavSecrets`) |
| `app/api/companies+api.ts` (GET/POST/PATCH) | settings + onboarding read/write |
| `app/api/nav/check+api.ts` | "Kapcsolat tesztelése" (typed overrides, never persisted) |
| `app/api/receipts/[id]/submit-nav+api.ts`, `lib/nav-receipt/*` | receipt report (manual + cron) |
| `lib/nav/incoming-sync.ts` | incoming invoice sync (still a stub) |
| `lib/m2m/credentials.ts` | M2M: **server env only** (`M2M_*`), one shared owner account — no per-user M2M storage exists yet (Phase 4) |
| `NAV_TEST_*` env | shared InvoHub NAV test account (env only) |
| Admin (`app/api/admin/*`, `lib/admin/service.ts`) | selects only `company.name` — no secret columns |
| v1 external API (`app/api/v1/*`) | never touches the company secret columns |

## 2. Findings

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | **High** | `/api/m2m/demo?taxpayerId=…` lets any signed-in user query any taxpayer through the owner's shared `M2M_*` account; with `M2M_ENV=production` that is live NAV tax data of arbitrary third parties (and `/api/m2m/check` would hit production too). | **Fixed** — both routes return 403 when M2M is configured for production. |
| F2 | Medium | `getCompanyByUserId()` decrypted all three secrets on **every** read (PDF, e-mail, reminders, invoice numbering, settings GET…). Plaintext lived in memory far beyond request signing, and a missing/rotated key made every one of those paths throw (PDFs/e-mails down). | **Fixed** — `Company` now carries the sealed value; decryption only in `openCompanyNavSecrets()` / receipt path, right before the NAV call. |
| F3 | Medium | Receipt submit route (`/api/receipts/[id]/submit-nav`) ignored `NAV_PRODUCTION_ENABLED`: a company whose stored mode is `production` (saved while the switch was on) would call NAV production after the switch was turned off. | **Fixed** — 400 unless production is enabled. |
| F4 | Medium | `POST /api/companies` (and receipt submit 500s) returned `error.message` and logged the raw error. A Drizzle failure message is `Failed query: … params: …` and `cause` carries bound values — i.e. sealed secrets, tax numbers etc. went to the client and to logs. | **Fixed** — `lib/api/safe-error.ts` (`safeErrorMessage`, `logSafeError`) used in companies, receipt submit and NAV check routes. |
| F5 | Medium | No key-rotation path: format `gcm1:iv:tag:ct` had no key id, only one key could ever be configured. | **Fixed** — new `gcm2:<kid>:iv:tag:ct`, `NAV_CREDENTIALS_KEY_ID`, `NAV_CREDENTIALS_PREVIOUS_KEYS`; `gcm1` still read (current key, then previous keys). |
| F6 | Low | GCM auth tag length not enforced on decrypt (Node accepts truncated tags down to 4 bytes unless `authTagLength` is set) → weaker forgery resistance. | **Fixed** — 12-byte IV and 16-byte tag enforced. |
| F7 | Low | `/api/nav/check` merged request-body overrides over the stored (sealed) values; a body value shaped like a ciphertext would be decrypted server-side (decryption-oracle shape), and an echoed mask would be used as the password. | **Fixed** — sealed-looking and masked overrides are ignored. |
| F8 | Low | `upsertCompany` would store an echoed mask (`"••••"`) as the new password. | **Fixed** — masked input = "leave unchanged" (omitting the field already was). |
| F9 | Low | `lib/seed/demo-data.ts` wrote placeholder secrets in **plaintext** (+ a fake technical user that the receipt cron would pick up). | **Fixed** — seed writes no NAV secrets. |
| F10 | Low | `loadNavReceiptCredentialsFromCompany()` returned stored values as if plaintext (unused today, but a trap). | **Fixed** — decrypts. |
| F11 | Info | API responses only had `*Set` booleans; no mask / overall "configured" flag. | **Fixed** — added `nav*Masked` (fixed `"••••••••"`, never derived from the secret so no decryption needed) + `navCredentialsConfigured`. |
| F12 | Info | Legacy plaintext rows (written before encryption shipped) are still read transparently. | **Mitigated** — `scripts/reencrypt-nav-secrets.mjs` (not run). Remove the passthrough once it has been run in production. |

Checked and OK (no change needed):

- Cipher: AES-256-GCM, 32-byte key from env, random 96-bit IV per value, auth tag verified; saving a secret without `NAV_CREDENTIALS_KEY` is refused (no plaintext write fallback).
- Access control: every route that reads/writes credentials uses `requireSession()` and scopes by `session.user.id`; there is no id parameter to tamper with, body `userId`/`id` are ignored (tests added). No DELETE route; clearing is `""` on the owner's own POST.
- Admin list/detail and v1 API never select the secret columns (now enforced by a static guard test).
- NAV crypto: SHA-512 password hash and SHA3-512 request signature are computed from the in-memory plaintext inside the NAV client only; `real-client.ts` error messages include only NAV *response* text, not the request (no password hash/signature).
- Daily receipt cron already decrypted per row with per-company failure handling.
- M2M secrets are env-only; the check route never echoes them (test added).

## 3. What changed (files)

- `lib/nav/credentials.ts` — key ring (current + previous), `gcm2` format, strict IV/tag, `needsNavSecretReencryption`, `maskNavSecret`, `isMaskedNavSecret`; error messages never include values.
- `lib/nav/reencrypt.ts` + `scripts/reencrypt-nav-secrets.mjs` — dry-run by default, `--apply` does compare-and-set UPDATEs; prints counts and row ids only.
- `lib/companies/service.ts` — no decryption in `mapRow`; masked/non-string input leaves the secret unchanged.
- `lib/companies/public-company.ts` — masks + `navCredentialsConfigured`.
- `lib/nav/resolve-credentials.ts` — `openCompanyNavSecrets()`; undecryptable → user-facing `NavCredentialsMissingError`.
- `app/api/receipts/[id]/submit-nav+api.ts` — decrypt at call time, production gate, safe errors.
- `app/api/nav/check+api.ts`, `app/api/companies+api.ts` — safe errors, override hardening.
- `app/api/m2m/{demo,check}+api.ts` — production refused.
- `lib/nav/incoming-sync.ts`, `lib/nav-receipt/credentials.ts`, `lib/seed/demo-data.ts`.
- `lib/api/safe-error.ts` — new.
- `.env.example`, `docs/nav-test-setup.md`, `db/schema.ts` comment.
- Tests: `lib/nav/credentials.test.ts`, `lib/nav/reencrypt.test.ts`, `lib/api/safe-error.test.ts`, `lib/companies/service.test.ts`, `lib/nav/resolve-credentials.test.ts`, `lib/nav/incoming-sync.test.ts`, `lib/nav-receipt/credentials.test.ts`, `lib/seed/demo-data.test.ts`, `__tests__/api/{companies,m2m-demo,m2m-check}.test.ts`, `__tests__/api/nav/check-api.test.ts`, `__tests__/api/receipts/submit-nav.test.ts`, `__tests__/security/nav-secret-exposure.test.ts` (static guard).

No schema change, no migration, no `db:push`.

## 4. Owner actions

1. **Vercel:** make sure `NAV_CREDENTIALS_KEY` is set (Production + Preview) and backed up in a password manager. Optionally set `NAV_CREDENTIALS_KEY_ID=k1` (the default). Leave `NAV_CREDENTIALS_PREVIOUS_KEYS` empty.
2. After this ships, run once from a trusted machine: `node scripts/reencrypt-nav-secrets.mjs` (dry run) → `--apply`. It encrypts any legacy plaintext rows and upgrades `gcm1` → `gcm2`.
3. Do not set `M2M_ENV=production` on the shared account.

## 5. Remaining / follow-ups

| Severity | Item |
|---|---|
| Low | Remove the legacy-plaintext read passthrough (`decryptNavSecretOrPassthrough`) once step 2 has run in production and reported 0 plaintext rows. |
| Low | Bind ciphertext to its row with GCM AAD (e.g. `company.id` + column) so a DB-write attacker can't copy one user's sealed secret into another row. Needs a `gcm3` format + re-encryption; not worth it before a DB-write threat exists. |
| Low | `nav_technical_user` (login) is stored and returned in plaintext. It is an identifier, not a secret, but could be masked in GET if desired. |
| Info | Per-user M2M credentials don't exist yet (Phase 4). When added, reuse `lib/nav/credentials.ts` (sealed at rest, decrypt at call time, masked in API) and re-run this review — Phase 4 launch gate requires a threat model. |
| Info | `lib/nav/incoming-sync.ts` / `fetchIncomingInvoices` is still a stub; it now receives the decrypted key, so an undecryptable key fails the sync instead of silently passing ciphertext. |
