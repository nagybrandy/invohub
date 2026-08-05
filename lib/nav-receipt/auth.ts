// lib/nav-receipt/auth.ts
import { createHash, randomUUID } from "crypto";

import type { NavReceiptAuthToken, NavReceiptCredentials, NavReceiptEnvironment } from "./types";
import { getReceiptBaseUrl } from "./environment";

let cachedToken: NavReceiptAuthToken | null = null;

function hashPassword(password: string): string {
  return createHash("sha512").update(password, "utf8").digest("hex").toUpperCase();
}

function isTokenValid(token: NavReceiptAuthToken): boolean {
  return token.expiresAt.getTime() > Date.now() + 30_000;
}

export async function authenticate(
  credentials: NavReceiptCredentials,
  env: NavReceiptEnvironment
): Promise<NavReceiptAuthToken> {
  if (cachedToken && isTokenValid(cachedToken)) {
    return cachedToken;
  }

  const baseUrl = getReceiptBaseUrl(env);
  const requestId = randomUUID();
  const passwordHash = hashPassword(credentials.technicalPassword);

  const body = {
    header: {
      requestId,
      timestamp: new Date().toISOString(),
    },
    user: {
      login: credentials.technicalUser,
      passwordHash,
      taxNumber: credentials.taxNumber,
    },
  };

  const res = await fetch(`${baseUrl}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: { token?: string; tokenValiditySeconds?: number; resultCode?: string; resultMessage?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`NAV receipt auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok || !parsed.token) {
    throw new Error(
      `NAV receipt auth failed: ${parsed.resultCode ?? res.status} ${parsed.resultMessage ?? ""}`.trim()
    );
  }

  const expiresAt = new Date(Date.now() + (parsed.tokenValiditySeconds ?? 300) * 1000);
  cachedToken = { token: parsed.token, expiresAt };
  return cachedToken;
}

export function clearAuthCache(): void {
  cachedToken = null;
}
