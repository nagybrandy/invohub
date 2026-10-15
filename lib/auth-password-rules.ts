// lib/auth-password-rules.ts
// What a new password must satisfy before anything is sent to Better Auth
// (which enforces its own minimum of 8 as well).
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirm: string): "tooShort" | "mismatch" | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "tooShort";
  if (password !== confirm) return "mismatch";
  return null;
}
