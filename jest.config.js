// jest.config.js
// Jest preset for Expo unit/integration tests across web and native targets.
const path = require("path");

// Jest only ever scans inside its own rootDir (this directory) — it never
// reaches into sibling directories. So when THIS config lives inside a git
// worktree (.claude/worktrees/<id>/jest.config.js), excluding
// ".claude/worktrees/" would match this worktree's OWN rootDir path and
// silently discard every test in the suite (0 matches). The exclusion is
// only meaningful when running from the MAIN checkout, where other
// worktrees' full source trees are physically nested underneath and would
// otherwise be double-scanned.
const isRunningInsideAWorktree = __dirname
  .split(path.sep)
  .includes("worktrees") && __dirname.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`);

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Default (5000ms) is occasionally too tight in CI for tests that render a
  // full screen tree (e.g. __tests__/screens/*) under `--coverage`
  // instrumentation on a loaded runner — seen 2026-09-15 as a one-off CI
  // timeout on a test that ran in <1s locally. Doubling gives real hangs
  // plenty of room to still fail loudly while absorbing that variance.
  testTimeout: 10000,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: [
    "**/__tests__/**/*.(test|spec).(ts|tsx)",
    "**/*.(test|spec).(ts|tsx)",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/e2e/",
    "/dist/",
    "/.expo/",
    // Nested git worktrees for other concurrent Claude sessions live under
    // .claude/worktrees/ inside this checkout — never run their tests as
    // part of this repo's own suite. Skipped when this config itself is
    // already running from inside one such worktree (see above).
    ...(isRunningInsideAWorktree ? [] : ["/.claude/worktrees/"]),
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^test-renderer$": "react-test-renderer",
    "\\.(png|jpg|jpeg|gif|webp|svg)$": "<rootDir>/__tests__/mocks/fileMock.js",
  },
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "app/api/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gluestack-ui/.*|@gluestack-ui|nativewind|react-native-css-interop|lucide-react-native|@neondatabase/.*|drizzle-orm/.*)",
  ],
};
