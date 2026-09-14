// lib/auth-signup-role.ts
// Clamps a client-supplied signup role choice to the two allowed, non-privileged
// values. Kept free of `better-auth` imports so it's testable in isolation and
// safely reusable from both the databaseHooks in lib/auth.ts and any callers.
import { SIGNUP_ROLES, type SignupRole } from "@/lib/user-roles";

const DEFAULT_SIGNUP_ROLE: SignupRole = "entrepreneur";

/**
 * Returns `value` if it is exactly "entrepreneur" or "accountant", otherwise
 * the default. Never returns "admin" or anything else — this is the single
 * choke point that makes it safe to accept a client-supplied role choice at
 * signup without the `role` column itself ever taking untrusted input
 * (see lib/auth-user-fields.ts: `role.input` stays `false`).
 */
export function resolveSignupRole(value: unknown): SignupRole {
  if (typeof value === "string" && (SIGNUP_ROLES as readonly string[]).includes(value)) {
    return value as SignupRole;
  }
  return DEFAULT_SIGNUP_ROLE;
}
