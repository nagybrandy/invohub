// lib/dev/seed-guard.ts
// Gates the demo data seed route (app/api/dev/seed+api.ts) so it can never run in
// production, even if it's accidentally left deployed.
export function isDevSeedAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ALLOW_DEV_SEED !== "true") return false;
  if (env.NODE_ENV === "production") return false;
  if (env.VERCEL_ENV === "production") return false;
  return true;
}
