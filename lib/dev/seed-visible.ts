// lib/dev/seed-visible.ts
// Client-side twin of lib/dev/seed-guard.ts: whether the UI may show the demo
// data seed button — and, just as important, whether any copy may point the user
// at it. The server route stays gated separately; this only decides what is said.
export function isDevSeedButtonVisible(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.EXPO_PUBLIC_ALLOW_DEV_SEED === "true";
}
