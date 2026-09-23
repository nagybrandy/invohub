// lib/api/safe-error.ts
// Error → text that is safe to return to a client or write to logs.
//
// Drizzle's DrizzleQueryError message is "Failed query: <sql>\nparams: <values>"
// and the pg driver attaches bound values to `cause` — for the company table
// that means sealed NAV secrets, tax numbers, etc. Route handlers must use
// these helpers instead of `error.message` / `console.error(error)` on any path
// that may have touched credential columns.

const SEALED_SECRET = /gcm[12]:[A-Za-z0-9_-]*:?[A-Za-z0-9+/=]*:[A-Za-z0-9+/=]*:[A-Za-z0-9+/=]*/g;

function sanitize(message: string): string {
  const withoutParams = message.split(/\n?\s*params:/i)[0];
  return withoutParams.replace(SEALED_SECRET, "[redacted]").trim();
}

/** A client-safe message for `error`, or `fallback` when the error is a raw DB failure / not an Error. */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (/^Failed query:/i.test(error.message)) return fallback;
  const cleaned = sanitize(error.message);
  return cleaned || fallback;
}

/** console.error with only the error's name and sanitized message — never the raw object (its `cause` may carry bound SQL params). */
export function logSafeError(label: string, error: unknown): void {
  if (error instanceof Error) {
    const message = /^Failed query:/i.test(error.message) ? "database query failed" : sanitize(error.message);
    console.error(label, `${error.name}: ${message}`);
  } else {
    console.error(label, "non-Error thrown");
  }
}
