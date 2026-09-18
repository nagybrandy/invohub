// lib/nav-receipt/auth.ts
import type { NavReceiptAuthToken, NavReceiptCredentials, NavReceiptEnvironment } from "./types";
import { getReceiptBaseUrl } from "./environment";
import { parseNavReceiptResponse } from "./response";
import { buildAuthTokenXml } from "./xml-builder";

// Keyed by credentials identity + environment, not a single module-level
// token — this module runs once per process, and the daily receipt-report
// cron (app/api/cron/nav-receipt-report+api.ts) authenticates for every
// company's own NAV credentials in a loop within that one process. A
// single shared variable would hand company B a still-valid token minted
// for company A's credentials.
const tokenCache = new Map<string, NavReceiptAuthToken>();

function cacheKey(env: NavReceiptEnvironment, credentials: NavReceiptCredentials): string {
  return `${env}:${credentials.taxNumber}:${credentials.technicalUser}`;
}

function isTokenValid(token: NavReceiptAuthToken): boolean {
  return token.expiresAt.getTime() > Date.now() + 30_000;
}

export async function authenticate(
  credentials: NavReceiptCredentials,
  env: NavReceiptEnvironment
): Promise<NavReceiptAuthToken> {
  if (env === "demo") {
    // Demo is a local simulation — callers must never route here for a
    // demo-mode company (see app/api/receipts/[id]/submit-nav+api.ts /
    // app/api/cron/nav-receipt-report+api.ts, which branch before calling
    // authenticate at all). Fail loudly rather than silently going to the
    // network with a demo credential.
    throw new Error("authenticate() must not be called in demo mode — demo never reaches NAV.");
  }

  const key = cacheKey(env, credentials);
  const cached = tokenCache.get(key);
  if (cached && isTokenValid(cached)) {
    return cached;
  }

  const baseUrl = getReceiptBaseUrl(env);
  const xml = buildAuthTokenXml(credentials);

  const res = await fetch(`${baseUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });

  const body = await res.text();
  const parsed = parseNavReceiptResponse(body, ["token", "validTo"]);

  if (!parsed) {
    throw new Error(`NAV eNyugta auth failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  const token = parsed.token;
  const validTo = parsed.validTo;

  if (!res.ok || !token || !validTo) {
    const resultCode = parsed.resultCode ?? String(res.status);
    const message = parsed.message ?? "Unknown NAV error.";
    throw new Error(`NAV eNyugta auth rejected: ${resultCode} ${message}`.trim());
  }

  const authToken: NavReceiptAuthToken = { token, expiresAt: new Date(validTo) };
  tokenCache.set(key, authToken);
  return authToken;
}

export function clearAuthCache(): void {
  tokenCache.clear();
}
