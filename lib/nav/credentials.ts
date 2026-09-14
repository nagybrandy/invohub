// lib/nav/credentials.ts
// AES-256-GCM encryption for NAV technical secrets at rest (server-only).
// Key comes from NAV_CREDENTIALS_KEY (base64, 32 bytes) — generate with:
//   openssl rand -base64 32
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_PREFIX = "gcm1";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM

export class NavCredentialsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NavCredentialsConfigError";
  }
}

function loadKey(): Buffer {
  const raw = process.env.NAV_CREDENTIALS_KEY?.trim();
  if (!raw) {
    throw new NavCredentialsConfigError(
      "NAV_CREDENTIALS_KEY nincs beállítva. Generáláshoz: openssl rand -base64 32"
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new NavCredentialsConfigError("NAV_CREDENTIALS_KEY nem érvényes base64 érték.");
  }
  if (key.length !== 32) {
    throw new NavCredentialsConfigError(
      `NAV_CREDENTIALS_KEY 32 bájtra kell dekódolódjon (jelenleg ${key.length}). Generáláshoz: openssl rand -base64 32`
    );
  }
  return key;
}

export function isNavCredentialsEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypts a secret for storage. Returns a versioned, self-contained string (`gcm1:iv:tag:ciphertext`, all base64). */
export function encryptNavSecret(plainText: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [FORMAT_PREFIX, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

/** Decrypts a value produced by encryptNavSecret. Throws on tampering, corruption, or the wrong key. */
export function decryptNavSecret(stored: string): string {
  const key = loadKey();
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_PREFIX) {
    throw new NavCredentialsConfigError("A tárolt NAV titok formátuma nem a várt titkosított formátum.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** True if `value` looks like it was produced by encryptNavSecret (vs. legacy/plain text). */
export function isEncryptedNavSecret(value: string | null | undefined): boolean {
  return !!value && value.startsWith(`${FORMAT_PREFIX}:`);
}

/** Encrypts `plainText` if set, else returns null (used when patching optional secret fields). */
export function encryptNavSecretOrNull(plainText: string | null | undefined): string | null {
  if (!plainText) return null;
  return encryptNavSecret(plainText);
}

/** Decrypts `stored` if it looks encrypted, otherwise returns it as-is (legacy plaintext rows). */
export function decryptNavSecretOrPassthrough(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  return isEncryptedNavSecret(stored) ? decryptNavSecret(stored) : stored;
}
