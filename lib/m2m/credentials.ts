// lib/m2m/credentials.ts
// M2M credentials from server environment variables.
import { parseM2mEnvironment, type M2mEnvironment } from "@/lib/m2m/environment";

export type M2mCredentials = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  signatureKeyFirst: string;
  nonce: string;
  environment: M2mEnvironment;
};

export class M2mConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "M2mConfigError";
  }
}

export function loadM2mCredentialsFromEnv(): M2mCredentials {
  const clientId = process.env.M2M_CLIENT_ID?.trim();
  const clientSecret = process.env.M2M_CLIENT_SECRET?.trim();
  const username = process.env.M2M_USERNAME?.trim();
  const password = process.env.M2M_PASSWORD?.trim();
  const signatureKeyFirst = process.env.M2M_SIGNATURE_KEY_FIRST?.trim();
  const nonce = process.env.M2M_NONCE?.trim();

  const missing = [
    !clientId && "M2M_CLIENT_ID",
    !clientSecret && "M2M_CLIENT_SECRET",
    !username && "M2M_USERNAME",
    !password && "M2M_PASSWORD",
    !signatureKeyFirst && "M2M_SIGNATURE_KEY_FIRST",
    !nonce && "M2M_NONCE",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new M2mConfigError(
      `Missing M2M env vars: ${missing.join(", ")}. Copy from .env.example.`
    );
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    username: username!,
    password: password!,
    signatureKeyFirst: signatureKeyFirst!,
    nonce: nonce!,
    environment: parseM2mEnvironment(process.env.M2M_ENV),
  };
}

export function isM2mConfigured(): boolean {
  try {
    loadM2mCredentialsFromEnv();
    return true;
  } catch {
    return false;
  }
}
