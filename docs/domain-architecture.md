# InvoHub domain architecture

## Chosen architecture

Use one Expo codebase and one Vercel project with two production domains:

- `invohub.hu` (plus `www.invohub.hu`) is canonical for marketing and legal pages.
- `app.invohub.hu` is canonical for sign-in and every authenticated product route.

The server entry applies permanent host redirects before Expo Router handles the request. Preview deployments and localhost are unaffected. Keeping one deployment avoids duplicating API routes, auth configuration, build output, and release coordination while still giving users and search engines clean domain boundaries.

## Vercel and DNS launch checklist

No DNS or production settings are changed by this repository update.

1. Add `invohub.hu`, `www.invohub.hu`, and `app.invohub.hu` to the same Vercel project.
2. Configure the apex `A`/`ALIAS` and both `CNAME` records exactly as Vercel's Domains screen specifies. DNS values vary by account and must not be guessed.
3. Set production environment variables:
   - `MARKETING_HOST=invohub.hu`
   - `APP_HOST=app.invohub.hu`
   - Better Auth's canonical/base URL to `https://app.invohub.hu`
   - trusted origins to both `https://invohub.hu` and `https://app.invohub.hu`
4. Scope authentication cookies to `app.invohub.hu` unless a reviewed cross-subdomain use case requires `.invohub.hu`. Keep `Secure`, `HttpOnly`, and an appropriate `SameSite` policy.
5. Redirect `www.invohub.hu` to `https://invohub.hu` in Vercel Domains.
6. Verify TLS, OAuth callback URLs, CORS/trusted origins, e-mail links, cron URLs, sitemap/canonical metadata, and each host redirect on a preview-compatible test domain before production cutover.
7. Add legal publisher details and obtain Hungarian lawyer/DPO approval before indexing the legal pages.

## Canonical paths

Marketing/legal: `/`, `/aszf`, `/adatkezeles`, `/cookie-tajekoztato`, `/impresszum`.

Product: `/login`, `/onboarding`, `/dashboard`, `/invoices`, `/receipts`, `/clients`, `/products`, `/import`, `/settings`, `/admin`.

Static assets and API requests remain on the requested deployment host. API clients should use `https://app.invohub.hu` as their production base URL.
