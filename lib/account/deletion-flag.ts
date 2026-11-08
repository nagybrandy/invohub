// lib/account/deletion-flag.ts
// Master switch for the self-serve account deletion REQUEST flow. Default OFF:
// with the flag off the API routes answer 404 and the Beállítások section is
// not rendered. Only the exact string "true" turns it on. Proposal:
// docs/decisions/2026-11-08-self-serve-account-deletion.md (needs owner + legal sign-off).

/** Server side (API routes). */
export function isAccountDeletionEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ACCOUNT_DELETION_ENABLED === "true";
}

/** Client twin (inlined at build time by Expo) — only decides whether the UI is shown. */
export function isAccountDeletionUiVisible(env: Record<string, string | undefined> = process.env): boolean {
  return env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED === "true";
}
