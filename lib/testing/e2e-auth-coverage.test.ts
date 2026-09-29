// lib/testing/e2e-auth-coverage.test.ts
import {
  AUTH_SKIP_MARKER,
  summarizeAuthCoverage,
  type E2ETestOutcome,
} from "@/lib/testing/e2e-auth-coverage";

const skippedForCredentials = (title: string): E2ETestOutcome => ({
  title,
  status: "skipped",
  annotations: [
    {
      type: "skip",
      description: "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs.",
    },
  ],
});

describe("summarizeAuthCoverage", () => {
  it("counts the specs that skipped because no E2E credentials were configured", () => {
    const summary = summarizeAuthCoverage([
      skippedForCredentials("dashboard page loads with title"),
      skippedForCredentials("invoice list shows the seeded invoice"),
      { title: "login page renders", status: "passed" },
    ]);

    expect(summary.skippedForCredentials).toBe(2);
    expect(summary.titles).toEqual([
      "dashboard page loads with title",
      "invoice list shows the seeded invoice",
    ]);
  });

  it("does not count a skip that has nothing to do with credentials", () => {
    const summary = summarizeAuthCoverage([
      { title: "flaky on webkit", status: "skipped", annotations: [{ type: "skip", description: "webkit only" }] },
      { title: "fixme", status: "skipped", annotations: [{ type: "fixme" }] },
    ]);

    expect(summary.skippedForCredentials).toBe(0);
  });

  it("reports a clean run when every authenticated spec actually ran", () => {
    const summary = summarizeAuthCoverage([
      { title: "dashboard page loads with title", status: "passed" },
      { title: "login page renders", status: "passed" },
    ]);

    expect(summary.skippedForCredentials).toBe(0);
    expect(summary.markdown).toMatch(/authenticated/i);
    expect(summary.markdown).not.toMatch(/⚠️/);
  });

  it("writes a summary that names the count and how to turn the specs on", () => {
    const summary = summarizeAuthCoverage([skippedForCredentials("dashboard page loads with title")]);

    expect(summary.markdown).toContain("⚠️");
    expect(summary.markdown).toContain("1");
    expect(summary.markdown).toContain("E2E_TEST_EMAIL");
    expect(summary.markdown).toContain("dashboard page loads with title");
  });

  it("keeps the marker it matches on in one place, so the specs and the reporter can't drift", () => {
    expect(
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (see TESTING.md) to run authenticated specs."
    ).toContain(AUTH_SKIP_MARKER);
  });

  it("survives a report with no annotations at all", () => {
    expect(summarizeAuthCoverage([]).skippedForCredentials).toBe(0);
    expect(summarizeAuthCoverage([{ title: "x", status: "skipped" }]).skippedForCredentials).toBe(0);
  });
});
