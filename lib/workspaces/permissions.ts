// lib/workspaces/permissions.ts
// Who may do what inside a billing account. Pure — the server applies it in
// requireSession (lib/api/session.ts) so EVERY route is covered at once, and
// the UI uses the same table to decide what to offer.
//
//   owner       the account's own person / the workspace's creator — everything
//   admin       everything except being the owner (can manage access)
//   accountant  works with the data (invoices, receipts, partners, products,
//               exports, e-mail, reminders, NAV submission) but cannot change
//               the company/NAV credentials, API keys or who has access
//   viewer      read-only
//
// The accountant's WRITES are an ALLOWLIST of path prefixes: a route added
// later is closed to them until somebody opens it on purpose (a deny-list
// would leave every new route writable by default).
export const WORKSPACE_ROLES = ["owner", "admin", "accountant", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be handed out through an invitation (there is exactly one owner). */
export const INVITABLE_ROLES = ["admin", "accountant", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const isWorkspaceRole = (v: unknown): v is WorkspaceRole => (WORKSPACE_ROLES as readonly string[]).includes(v as string);
export const isInvitableRole = (v: unknown): v is InvitableRole => (INVITABLE_ROLES as readonly string[]).includes(v as string);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Canonical form the rules are matched against. The router accepts a trailing
 * slash (`/api/companies/`) and the rules are anchored, so without this a
 * request could slip past a `$`-anchored rule and still reach the handler.
 */
export function normalizeApiPath(pathname: string): string {
  let p = pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep the raw path; it will not match an allow rule */
  }
  p = p.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/** Reads that must stay owner/admin-only even though they are GETs. */
const SENSITIVE_READ = [
  /^\/api\/api-keys(\/|$)/,
  /^\/api\/workspaces\/(members|invites)(\/|$)/,
  /^\/api\/nav\/check$/, // GET performs a live NAV token exchange with the stored credentials
  /^\/api\/m2m\/check$/,
  /^\/api\/dev(\/|$)/,
];

/** POSTs that only compute or preview something and change nothing — a viewer may call them. */
const SAFE_POSTS = [/^\/api\/invoices\/preview\/pdf$/, /^\/api\/pdf-template$/];

/** What an accountant may WRITE to (everything else is owner/admin only). */
const ACCOUNTANT_WRITABLE = [
  /^\/api\/invoices(\/|$)/,
  /^\/api\/receipts(\/|$)/,
  /^\/api\/clients(\/|$)/,
  /^\/api\/products(\/|$)/,
  /^\/api\/email-templates(\/|$)/,
  /^\/api\/pdf-template$/,
  /^\/api\/reminders(\/|$)/,
  /^\/api\/notifications(\/|$)/,
  /^\/api\/payments$/,
  /^\/api\/import(\/|$)/,
  /^\/api\/nav\/(submit|status|incoming)$/,
];

/**
 * Platform routes act on the signed-in PERSON, never on a selected account:
 * requireSession ignores the account selection for them.
 */
export const isPlatformPath = (pathname: string): boolean => /^\/api\/admin(\/|$)/.test(normalizeApiPath(pathname));

export function canPerform(role: WorkspaceRole, method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  const path = normalizeApiPath(pathname);
  if (role === "owner" || role === "admin") return true;

  if (READ_METHODS.has(m)) return !SENSITIVE_READ.some((re) => re.test(path));
  if (role === "viewer") return m === "POST" && SAFE_POSTS.some((re) => re.test(path));
  // accountant
  return ACCOUNTANT_WRITABLE.some((re) => re.test(path));
}

/** UI: may this role manage who has access (invite, change role, revoke)? */
export const canManageAccess = (role: WorkspaceRole): boolean => role === "owner" || role === "admin";

/** Only the owner may hand out, change or take away the administrator role. */
export const canManageAdmins = (role: WorkspaceRole): boolean => role === "owner";

/** UI: may this role edit data at all? */
export const canWrite = (role: WorkspaceRole): boolean => role !== "viewer";
