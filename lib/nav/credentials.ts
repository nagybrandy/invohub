// lib/nav/credentials.ts
// AES-256-GCM encryption for NAV technical secrets at rest (server-only).
//
// Keys come from the environment only (never the DB, never the repo):
//   NAV_CREDENTIALS_KEY            current key, base64, 32 bytes
//                                  (generate with: openssl rand -base64 32)
//   NAV_CREDENTIALS_KEY_ID         id of the current key (default "k1"),
//                                  [A-Za-z0-9_-]{1,32}
//   NAV_CREDENTIALS_PREVIOUS_KEYS  retired keys still needed for reads,
//                                  "kid:base64[,kid:base64...]"
//
// Stored format (current):  gcm2:<kid>:<iv b64>:<tag b64>:<ciphertext b64>
// Legacy format (read-only): gcm1:<iv b64>:<tag b64>:<ciphertext b64>
//   gcm1 carries no key id, so it is tried against the current key and then
//   every previous key (GCM's auth tag makes a wrong key fail reliably).
//
// Rotation: set the new key as NAV_CREDENTIALS_KEY with a new
// NAV_CREDENTIALS_KEY_ID, move the old one into NAV_CREDENTIALS_PREVIOUS_KEYS,
// deploy, run scripts/reencrypt-nav-secrets.mjs --apply, then drop the old key.
//
// Error messages here never include the stored value or the plaintext.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const LEGACY_PREFIX = "gcm1";
const FORMAT_PREFIX = "gcm2";
const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
const AUTH_TAG_LENGTH = 16; // full 128-bit tag — never accept truncated tags
const DEFAULT_KEY_ID = "k1";
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/** What API responses show in place of a stored secret. Reveals nothing — not even a suffix — so it never requires decrypting. */
export const NAV_SECRET_MASK = "••••••••";

export class NavCredentialsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NavCredentialsConfigError";
  }
}

function decodeKey(raw: string, envName: string): Buffer {
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new NavCredentialsConfigError(
      `${envName} 32 bájtra kell dekódolódjon (jelenleg ${key.length}). Generáláshoz: openssl rand -base64 32`
    );
  }
  return key;
}

function loadCurrentKey(): { id: string; key: Buffer } {
  const raw = process.env.NAV_CREDENTIALS_KEY?.trim();
  if (!raw) {
    throw new NavCredentialsConfigError(
      "NAV_CREDENTIALS_KEY nincs beállítva. Generáláshoz: openssl rand -base64 32"
    );
  }
  const id = currentNavCredentialsKeyId();
  return { id, key: decodeKey(raw, "NAV_CREDENTIALS_KEY") };
}

/** The key id new values are written under (NAV_CREDENTIALS_KEY_ID, default "k1"). */
export function currentNavCredentialsKeyId(): string {
  const id = process.env.NAV_CREDENTIALS_KEY_ID?.trim() || DEFAULT_KEY_ID;
  if (!KEY_ID_PATTERN.test(id)) {
    throw new NavCredentialsConfigError("NAV_CREDENTIALS_KEY_ID csak [A-Za-z0-9_-] karaktereket tartalmazhat (max 32).");
  }
  return id;
}

function loadPreviousKeys(): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  const raw = process.env.NAV_CREDENTIALS_PREVIOUS_KEYS?.trim();
  if (!raw) return keys;
  for (const entry of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const sep = entry.indexOf(":");
    const id = sep > 0 ? entry.slice(0, sep) : "";
    if (!KEY_ID_PATTERN.test(id)) {
      throw new NavCredentialsConfigError(
        "NAV_CREDENTIALS_PREVIOUS_KEYS formátuma: kulcsazonosító:base64[,kulcsazonosító:base64]"
      );
    }
    keys.set(id, decodeKey(entry.slice(sep + 1), "NAV_CREDENTIALS_PREVIOUS_KEYS"));
  }
  return keys;
}

export function isNavCredentialsEncryptionConfigured(): boolean {
  try {
    loadCurrentKey();
    loadPreviousKeys();
    return true;
  } catch {
    return false;
  }
}

/** Encrypts a secret for storage: `gcm2:<kid>:<iv>:<tag>:<ciphertext>` (base64 parts), random IV per value. */
export function encryptNavSecret(plainText: string): string {
  const { id, key } = loadCurrentKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [FORMAT_PREFIX, id, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

function openWithKey(key: Buffer, ivB64: string, tagB64: string, dataB64: string): string {
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new NavCredentialsConfigError("A tárolt NAV titok sérült (érvénytelen IV vagy hitelesítő címke).");
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

const UNREADABLE_MESSAGE =
  "A tárolt NAV titok nem fejthető vissza (hibás vagy hiányzó kulcs, vagy sérült adat).";

/** Decrypts a value produced by encryptNavSecret (gcm2) or the legacy gcm1 format. Throws on tampering, corruption, or the wrong/missing key. */
export function decryptNavSecret(stored: string): string {
  const parts = stored.split(":");

  if (parts.length === 5 && parts[0] === FORMAT_PREFIX) {
    const [, kid, ivB64, tagB64, dataB64] = parts;
    const current = loadCurrentKey();
    const key = kid === current.id ? current.key : loadPreviousKeys().get(kid);
    if (!key) {
      throw new NavCredentialsConfigError(
        `A(z) "${kid}" azonosítójú NAV titkosítási kulcs nincs beállítva (NAV_CREDENTIALS_PREVIOUS_KEYS).`
      );
    }
    try {
      return openWithKey(key, ivB64, tagB64, dataB64);
    } catch (e) {
      if (e instanceof NavCredentialsConfigError) throw e;
      throw new NavCredentialsConfigError(UNREADABLE_MESSAGE);
    }
  }

  if (parts.length === 4 && parts[0] === LEGACY_PREFIX) {
    const [, ivB64, tagB64, dataB64] = parts;
    const candidates = [loadCurrentKey().key, ...loadPreviousKeys().values()];
    for (const key of candidates) {
      try {
        return openWithKey(key, ivB64, tagB64, dataB64);
      } catch (e) {
        if (e instanceof NavCredentialsConfigError) throw e;
        // wrong key — try the next one
      }
    }
    throw new NavCredentialsConfigError(UNREADABLE_MESSAGE);
  }

  throw new NavCredentialsConfigError("A tárolt NAV titok formátuma nem a várt titkosított formátum.");
}

/** True if `value` looks like it was produced by encryptNavSecret, current or legacy format (vs. legacy plain text). */
export function isEncryptedNavSecret(value: string | null | undefined): boolean {
  return !!value && (value.startsWith(`${FORMAT_PREFIX}:`) || value.startsWith(`${LEGACY_PREFIX}:`));
}

/**
 * True when a stored value should be rewritten by the re-encryption script:
 * legacy plaintext, legacy gcm1 (no key id), or gcm2 under a non-current key.
 */
export function needsNavSecretReencryption(stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (!isEncryptedNavSecret(stored)) return true;
  if (stored.startsWith(`${LEGACY_PREFIX}:`)) return true;
  const kid = stored.split(":")[1];
  return kid !== currentNavCredentialsKeyId();
}

/** Encrypts `plainText` if set, else returns null (used when patching optional secret fields). */
export function encryptNavSecretOrNull(plainText: string | null | undefined): string | null {
  if (!plainText) return null;
  return encryptNavSecret(plainText);
}

/**
 * Decrypts `stored` if it looks encrypted, otherwise returns it as-is (legacy
 * plaintext rows, until scripts/reencrypt-nav-secrets.mjs has been run).
 * Call this only right before building a NAV request — never to populate a
 * general-purpose read model.
 */
export function decryptNavSecretOrPassthrough(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  return isEncryptedNavSecret(stored) ? decryptNavSecret(stored) : stored;
}

/** API-safe stand-in for a stored secret: NAV_SECRET_MASK when one is on file, else null. */
export function maskNavSecret(stored: string | null | undefined): string | null {
  return stored ? NAV_SECRET_MASK : null;
}

/** True when a client echoed back the mask (e.g. "••••") instead of a new value — treat as "leave unchanged". */
export function isMaskedNavSecret(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[•*]+$/.test(trimmed);
}
