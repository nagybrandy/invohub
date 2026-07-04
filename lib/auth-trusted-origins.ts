// lib/auth-trusted-origins.ts
// Shared Better Auth trusted origins used for CSRF/origin checks and CORS.

const DEV_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
] as const;

export function getAuthTrustedOrigins(): string[] {
  const origins = new Set<string>([
    "invohub://",
    "exp://",
    ...DEV_ORIGINS,
  ]);

  if (process.env.EXPO_PUBLIC_AUTH_BASE_URL) {
    origins.add(process.env.EXPO_PUBLIC_AUTH_BASE_URL);
  }

  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (extra) {
    for (const origin of extra.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return [...origins];
}
