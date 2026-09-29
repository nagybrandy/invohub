// lib/notifications/i18n.ts
// lib/notifications/service.ts (server-side, no user-locale/react-i18next
// access) must not bake pre-rendered English strings into a notification's
// stored title/body -- those get shown verbatim to Hungarian users (round-2
// finding). Instead it stores an i18n key, optionally followed by a
// space-separated JSON params blob; the client decodes and translates it at
// render time via t(), in whatever language the viewer is using.
//
// Encoding note: the separator MUST be an ordinary printable character.
// PostgreSQL text columns reject NUL bytes outright (error 22021,
// invalid_encoding) -- do not "clarify" this to a control character again.
const SEPARATOR_CHAR_CODE = 32; // ASCII space
const PARAMS_SEPARATOR = String.fromCharCode(SEPARATOR_CHAR_CODE);

/** notifications.content.* keys are the only ones this encoding ever produces/recognizes. */
const NOTIFICATION_CONTENT_PREFIX = "notifications.content.";

export function encodeNotificationText(key: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return key;
  return key + PARAMS_SEPARATOR + JSON.stringify(params);
}

export function decodeNotificationText(stored: string): {
  key: string;
  params?: Record<string, unknown>;
} {
  const sepIndex = stored.indexOf(PARAMS_SEPARATOR);
  if (sepIndex === -1) return { key: stored };
  const key = stored.slice(0, sepIndex);
  try {
    return { key, params: JSON.parse(stored.slice(sepIndex + 1)) };
  } catch {
    return { key };
  }
}

// Legacy string patterns produced by lib/notifications/service.ts before the
// 2026-09-15 i18n-key encoding fix (commit 7efccac). Rows written before that
// fix landed still hold literal English prose in their title/body columns.
// Every pattern below is anchored (^...$) so it can only match a full,
// exact legacy string -- never a substring of unrelated text -- and the
// em dash (U+2014) is matched literally, exactly as the old code emitted it.
type LegacyPattern = {
  regex: RegExp;
  key: string;
  params?: (match: RegExpMatchArray) => Record<string, unknown>;
};

const LEGACY_PATTERNS: LegacyPattern[] = [
  {
    regex: /^Overdue: (.+)$/,
    key: "notifications.content.overdueInvoiceTitle",
    params: (m) => ({ number: m[1] }),
  },
  {
    regex: /^(.+) — payment past due date\.$/,
    key: "notifications.content.overdueInvoiceBody",
    params: (m) => ({ clientName: m[1] }),
  },
  {
    regex: /^(.+) — payment past due\.$/,
    key: "notifications.content.overdueInvoiceBody",
    params: (m) => ({ clientName: m[1] }),
  },
  {
    regex: /^Awaiting payment: (.+)$/,
    key: "notifications.content.invoiceSentTitle",
    params: (m) => ({ number: m[1] }),
  },
  {
    regex: /^Sent to (.+)\.$/,
    key: "notifications.content.invoiceSentBody",
    params: (m) => ({ clientName: m[1] }),
  },
  {
    regex: /^NAV submission pending$/,
    key: "notifications.content.navPendingTitle",
  },
  {
    regex: /^(.+) is waiting for NAV confirmation\.$/,
    key: "notifications.content.navPendingBody",
    params: (m) => ({ number: m[1] }),
  },
  {
    regex: /^Welcome to InvoHub$/,
    key: "notifications.content.welcomeTitle",
  },
  {
    regex: /^Load demo data from Settings to explore all features\.$/,
    key: "notifications.content.welcomeBody",
  },
  {
    regex: /^Payment reminder scheduled$/,
    key: "notifications.content.reminderScheduledTitle",
  },
  {
    regex: /^Automatic reminder will be sent in 7 days\.$/,
    key: "notifications.content.reminderScheduledBody",
  },
];

/**
 * Maps a pre-fix literal-English notification string back to its
 * `notifications.content.*` key + params encoding. Pure, non-destructive:
 * - a string already starting with the encoding prefix is returned unchanged
 *   (idempotent -- safe to call on already-fixed rows).
 * - any string matching none of the exact legacy patterns (user-authored
 *   text, Hungarian text, empty string, undefined, a near-miss with a
 *   trimmed period/suffix) is returned unchanged.
 * Never throws.
 */
export function normalizeLegacyNotificationText(
  stored: string | undefined,
  // referenceKey is accepted for future use (e.g. disambiguating identical
  // legacy strings across notification types) but is not currently needed
  // to resolve any of the 11 legacy patterns unambiguously.
  _referenceKey?: string
): string | undefined {
  if (stored === undefined) return undefined;
  if (stored.startsWith(NOTIFICATION_CONTENT_PREFIX)) return stored;

  for (const pattern of LEGACY_PATTERNS) {
    const match = stored.match(pattern.regex);
    if (match) {
      const params = pattern.params?.(match);
      return encodeNotificationText(pattern.key, params);
    }
  }

  return stored;
}

/**
 * Renders a stored notification title/body: normalizes any pre-fix legacy
 * literal text back to its key, decodes it, and translates it via `t` when
 * it's one of our own generated i18n keys -- or returns it unchanged (and
 * never calls `t`) for anything unrecognised.
 */
export function translateNotificationText(
  t: (key: string, opts?: Record<string, unknown>) => string,
  stored: string | undefined,
  referenceKey?: string
): string | undefined {
  if (!stored) return stored;
  const normalized = normalizeLegacyNotificationText(stored, referenceKey) ?? stored;
  const { key, params } = decodeNotificationText(normalized);
  if (!key.startsWith(NOTIFICATION_CONTENT_PREFIX)) return stored;
  return t(key, params);
}
