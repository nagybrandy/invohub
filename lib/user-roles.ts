// lib/user-roles.ts
// User role helpers — admin, accountants, and entrepreneurs.
export const SIGNUP_ROLES = ["accountant", "entrepreneur"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const ALL_ROLES = ["admin", "accountant", "entrepreneur"] as const;
export type UserRole = (typeof ALL_ROLES)[number];

export function isAdmin(role: string | undefined | null): boolean {
  return role === "admin";
}

export function isAccountant(role: string | undefined | null): boolean {
  return role === "accountant";
}

/** Entrepreneurs, accountants, and admins manage partner/product directories. */
export function canManageClients(role: string | undefined | null): boolean {
  return isAdmin(role) || isAccountant(role) || role === "entrepreneur";
}

/** Admin sees every feature and the admin panel. */
export function canAccessAdminPanel(role: string | undefined | null): boolean {
  return isAdmin(role);
}

export function roleLabel(role: string | undefined | null): string {
  if (role === "admin") return "Admin";
  if (role === "accountant") return "Accountant";
  if (role === "entrepreneur") return "Entrepreneur";
  return "User";
}

export function isAssignableRole(role: string): role is UserRole {
  return (ALL_ROLES as readonly string[]).includes(role);
}
