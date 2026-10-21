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
export const WORKSPACE_ROLES = ["owner", "admin", "accountant", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be handed out through an invitation (there is exactly one owner). */
export const INVITABLE_ROLES = ["admin", "accountant", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const isWorkspaceRole = (v: unknown): v is WorkspaceRole => (WORKSPACE_ROLES as readonly string[]).includes(v as string);
export const isInvitableRole = (v: unknown): v is InvitableRole => (INVITABLE_ROLES as readonly string[]).includes(v as string);

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Reads that must stay owner/admin-only even though they are GETs. */
const SENSITIVE_READ = [/^\/api\/api-keys(\/|$)/, /^\/api\/workspaces\/(members|invites)(\/|$)/];

/** POSTs that only compute or preview something and change nothing — a viewer may call them. */
const SAFE_POSTS = [/^\/api\/invoices\/preview\/pdf$/, /^\/api\/pdf-template$/];

/** Writes reserved for owner/admin: credentials, API keys, access, company profile. */
const ADMIN_ONLY_WRITES = [
  /^\/api\/api-keys(\/|$)/,
  /^\/api\/companies$/,
  /^\/api\/nav\/check$/,
  /^\/api\/workspaces\/(members|invites)(\/|$)/,
  /^\/api\/dev\//,
];

/**
 * Platform routes act on the signed-in PERSON, never on a selected account:
 * requireSession ignores the account selection for them.
 */
export const isPlatformPath = (pathname: string): boolean => /^\/api\/admin(\/|$)/.test(pathname);

export function canPerform(role: WorkspaceRole, method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (role === "owner" || role === "admin") return true;

  if (READ_METHODS.has(m)) return !SENSITIVE_READ.some((re) => re.test(pathname));
  if (role === "viewer") return SAFE_POSTS.some((re) => re.test(pathname)) && m === "POST";
  // accountant
  return !ADMIN_ONLY_WRITES.some((re) => re.test(pathname));
}

/** UI: may this role manage who has access (invite, change role, revoke)? */
export const canManageAccess = (role: WorkspaceRole): boolean => role === "owner" || role === "admin";

/** UI: may this role edit data at all? */
export const canWrite = (role: WorkspaceRole): boolean => role !== "viewer";
