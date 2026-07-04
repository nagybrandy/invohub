// lib/auth-url.ts
// Resolves the Better Auth API base URL per platform.

/** Client-side auth API origin. Web uses the current page origin to avoid CORS and third-party cookies. */
export function getClientAuthBaseURL(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return process.env.EXPO_PUBLIC_AUTH_BASE_URL ?? "http://localhost:8081";
}

/** Server + client API base URL for `/api/*` routes. */
export function getAuthBaseUrl(): string {
  return getClientAuthBaseURL();
}
