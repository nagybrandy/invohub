// lib/account/auth-guards.ts
// Better Auth hooks that enforce invoice retention (lib/account/closure.ts).
// Kept free of `better-auth` imports so they can be unit tested; wired up in
// lib/auth.ts.
//
// Every FK from `user` is ON DELETE CASCADE, so deleting a user row would
// wipe issued invoices, line items, NAV submissions, receipts and the seller
// company that Áfa tv. 179. § / Számv. tv. 169. § (2) require us to keep.
// Hence: the user row may never be hard-deleted — not via Better Auth's
// /delete-user endpoint, its callback, a plugin (e.g. admin removeUser), or
// anything else that goes through the Better Auth adapter. Account deletion
// requests are served by closeAccount() instead.

export class UserHardDeleteBlockedError extends Error {
  readonly code = "USER_HARD_DELETE_BLOCKED";
  constructor() {
    super(
      "Hard-deleting a user is disabled: issued invoices must be retained for 8 years. Use account closure (lib/account/closure.ts) instead."
    );
    this.name = "UserHardDeleteBlockedError";
  }
}

export class ClosedAccountSignInError extends Error {
  readonly code = "ACCOUNT_CLOSED";
  constructor() {
    super("This account has been closed.");
    this.name = "ClosedAccountSignInError";
  }
}

/** databaseHooks.user.delete.before + deleteUser.beforeDelete — always throws. */
export async function blockUserHardDelete(): Promise<never> {
  throw new UserHardDeleteBlockedError();
}

/**
 * databaseHooks.session.create.before factory: refuses to mint a session for
 * a closed account. (Closure already deletes the credential account and
 * anonymizes the e-mail, so sign-in should fail earlier — this is the
 * defense-in-depth backstop, e.g. for a future OAuth/magic-link provider.)
 */
export function makeClosedAccountSessionGuard(
  isClosed: (userId: string) => Promise<boolean>
) {
  return async (sessionData: { userId: string }) => {
    if (await isClosed(sessionData.userId)) {
      throw new ClosedAccountSignInError();
    }
    return { data: sessionData };
  };
}
