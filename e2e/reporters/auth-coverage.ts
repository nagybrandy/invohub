// e2e/reporters/auth-coverage.ts
// Playwright reporter that answers, on every run: did the authenticated
// specs actually run, or did they sit out for want of credentials?
//
// The counting lives in lib/testing/e2e-auth-coverage.ts so it can be unit
// tested (jest ignores /e2e/). This file is only the plumbing: collect the
// results, then print the verdict and append it to the GitHub job summary.
import { appendFileSync } from "node:fs";
import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import {
  summarizeAuthCoverage,
  type E2ETestOutcome,
} from "../../lib/testing/e2e-auth-coverage";

export default class AuthCoverageReporter implements Reporter {
  private readonly outcomes: E2ETestOutcome[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    this.outcomes.push({
      title: test.titlePath().filter(Boolean).slice(1).join(" › ") || test.title,
      status: result.status,
      annotations: test.annotations.map((a) => ({ type: a.type, description: a.description })),
    });
  }

  onEnd() {
    const summary = summarizeAuthCoverage(this.outcomes);
    if (summary.skippedForCredentials > 0) {
      console.log(
        `\n⚠️  ${summary.skippedForCredentials} authenticated web E2E spec(s) were skipped — ` +
          `E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set, so the signed-in flows are not covered.\n` +
          `   See TESTING.md to turn them on.\n`
      );
    }

    // GitHub renders this under the job; harmless and ignored elsewhere.
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      try {
        appendFileSync(summaryFile, `${summary.markdown}\n`);
      } catch {
        // A summary that can't be written must never fail the run.
      }
    }
  }
}
