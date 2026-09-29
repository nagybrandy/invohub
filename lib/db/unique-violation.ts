// lib/db/unique-violation.ts
// Pure classifier for a Postgres unique-constraint violation (SQLSTATE
// 23505), used by app/api/invoices/[id]/convert+api.ts to turn a DB-level
// double-conversion race into the same 409 the pre-check already returns
// (see db/schema.ts's invoice_converted_from_live_unique_idx).
//
// Neon's HTTP driver sometimes wraps the underlying pg error as
// `error.cause`, so both the error itself and its cause are checked for
// `code === "23505"`. An optional `indexName` gives a second, looser way to
// recognize the violation by matching it against the driver's error
// message — useful when a driver surfaces a readable message but not a
// structured `code`. A caller that needs certainty about *which* index
// fired should re-verify against the database (see findExistingConversion
// in the route) rather than relying on this alone.
type MaybeError = { code?: unknown; message?: unknown; cause?: unknown };

const POSTGRES_UNIQUE_VIOLATION_CODE = "23505";

function asError(value: unknown): MaybeError | null {
  return value && typeof value === "object" ? (value as MaybeError) : null;
}

function hasUniqueViolationCode(value: unknown): boolean {
  return asError(value)?.code === POSTGRES_UNIQUE_VIOLATION_CODE;
}

function messageIncludes(value: unknown, needle: string): boolean {
  const message = asError(value)?.message;
  return typeof message === "string" && message.includes(needle);
}

export function isUniqueViolation(error: unknown, indexName?: string): boolean {
  const err = asError(error);
  if (!err) return false;

  if (hasUniqueViolationCode(err) || hasUniqueViolationCode(err.cause)) {
    return true;
  }

  if (indexName && (messageIncludes(err, indexName) || messageIncludes(err.cause, indexName))) {
    return true;
  }

  return false;
}
