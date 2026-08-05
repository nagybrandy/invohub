// lib/m2m/auth.ts
// NAV M2M token + signing key (nonce redeem).
import { randomUUID } from "crypto";
import type { M2mCredentials } from "@/lib/m2m/credentials";
import { M2M_COMMON_BASE_URL } from "@/lib/m2m/environment";

type TokenResponse = {
  accessToken?: string;
  resultCode?: string;
  resultMessage?: string;
};

type NonceResponse = {
  signatureKeySecondPart?: string;
  resultCode?: string;
  resultMessage?: string;
};

async function postJson<T>(url: string, messageId: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    messageId,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    throw new Error(`M2M request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`M2M request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return parsed;
}

export async function createM2mAccessToken(credentials: M2mCredentials): Promise<string> {
  const base = M2M_COMMON_BASE_URL[credentials.environment];
  const messageId = randomUUID();
  const data = await postJson<TokenResponse>(`${base}/NavM2mCommon/tokenService/Token`, messageId, {
    requestData: {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      username: credentials.username,
      password: credentials.password,
    },
  });

  if (!data.accessToken) {
    throw new Error(
      `M2M token creation failed: ${data.resultCode ?? "unknown"} ${data.resultMessage ?? ""}`.trim()
    );
  }
  return data.accessToken;
}

export async function resolveM2mSigningKey(
  credentials: M2mCredentials,
  accessToken: string
): Promise<string> {
  const base = M2M_COMMON_BASE_URL[credentials.environment];
  const messageId = randomUUID();
  const data = await postJson<NonceResponse>(
    `${base}/NavM2mCommon/userregistrationService/Nonce`,
    messageId,
    { requestData: { nonce: credentials.nonce } },
    accessToken
  );

  if (!data.signatureKeySecondPart) {
    throw new Error(
      `M2M nonce redeem failed: ${data.resultCode ?? "unknown"} ${data.resultMessage ?? ""}`.trim()
    );
  }
  return credentials.signatureKeyFirst + data.signatureKeySecondPart;
}

export async function createM2mSession(credentials: M2mCredentials): Promise<{
  accessToken: string;
  signingKey: string;
}> {
  const accessToken = await createM2mAccessToken(credentials);
  const signingKey = await resolveM2mSigningKey(credentials, accessToken);
  return { accessToken, signingKey };
}
