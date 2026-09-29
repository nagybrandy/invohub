// lib/testing/e2e-auth-coverage.ts
// Turns a Playwright run into an answer to one question: did the
// authenticated web specs actually run?
//
// Those specs guard themselves with `test.skip(!hasE2ECredentials, …)`
// (e2e/web/fixtures/auth.ts), which means a run with no E2E_TEST_EMAIL /
// E2E_TEST_PASSWORD reports a green suite while every signed-in flow —
// invoices, dashboard, settings, receipts, navigation — quietly sat out.
// A green check that covers less than it looks like is worse than a red
// one, so the reporter built on this (e2e/reporters/auth-coverage.ts) says
// so on every run.

/** The stable part of the specs' own skip message; matching on it keeps spec and reporter in step. */
export const AUTH_SKIP_MARKER = "E2E_TEST_EMAIL";

export type E2ETestOutcome = {
  title: string;
  status: string;
  annotations?: { type: string; description?: string }[];
};

export type AuthCoverageSummary = {
  /** How many specs sat out purely because no credentials were configured. */
  skippedForCredentials: number;
  /** Their titles, in the order the run reported them. */
  titles: string[];
  /** Ready to append to $GITHUB_STEP_SUMMARY (or print). */
  markdown: string;
};

function skippedForCredentials(test: E2ETestOutcome): boolean {
  if (test.status !== "skipped") return false;
  return (test.annotations ?? []).some(
    (a) => a.type === "skip" && (a.description ?? "").includes(AUTH_SKIP_MARKER)
  );
}

export function summarizeAuthCoverage(tests: E2ETestOutcome[]): AuthCoverageSummary {
  const titles = tests.filter(skippedForCredentials).map((t) => t.title);

  const markdown =
    titles.length === 0
      ? "### Web E2E\n\nEvery authenticated spec ran — no spec sat out for missing credentials.\n"
      : [
          "### Web E2E — authenticated specs did not run",
          "",
          `⚠️ **${titles.length}** spec(s) skipped because \`E2E_TEST_EMAIL\` / \`E2E_TEST_PASSWORD\` are not set,`,
          "so the signed-in flows are **not** covered by this green check.",
          "",
          "Set them (plus a scratch `DATABASE_URL`) as repository secrets to turn them on — see TESTING.md.",
          "",
          ...titles.map((t) => `- ${t}`),
          "",
        ].join("\n");

  return { skippedForCredentials: titles.length, titles, markdown };
}
