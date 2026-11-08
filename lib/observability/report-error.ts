// lib/observability/report-error.ts
// Minimal error reporter: one structured console line (picked up by Vercel
// logs) with the source, error class and code. Deliberately never logs
// error.message — DB driver and SMTP messages embed bound parameters (PII).
// Swap the body for an external tracker (Sentry etc.) later; callers stay.

export type DescribedError = { errorClass: string; code: string | undefined };

export function describeError(error: unknown): DescribedError {
  if (!(error instanceof Error)) return { errorClass: "NonError", code: undefined };
  const raw = (error as { code?: unknown }).code;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).slice(0, 40) : undefined;
  return { errorClass: error.constructor?.name || error.name || "Error", code };
}

export function reportError(
  source: string,
  error: unknown,
  context: Record<string, string | number | boolean> = {},
): void {
  try {
    console.error(
      JSON.stringify({ level: "error", source, ...describeError(error), ...context, at: new Date().toISOString() }),
    );
  } catch {
    // reporting must never throw
  }
}
