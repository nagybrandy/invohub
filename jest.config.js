// jest.config.js
// Jest preset for Expo unit/integration tests across web and native targets.
/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
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
    // part of this repo's own suite.
    "/.claude/worktrees/",
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
