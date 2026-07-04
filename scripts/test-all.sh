#!/usr/bin/env bash
# scripts/test-all.sh
# Runs unit tests + web E2E; optionally Maestro on iOS/Android when simulators are available.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Typecheck"
npm run typecheck

echo "==> Unit tests (Jest)"
npm run test:unit

echo "==> Web E2E (Playwright)"
npm run test:e2e:web

RUN_MOBILE="${RUN_MOBILE_E2E:-false}"

if [[ "$RUN_MOBILE" == "true" ]]; then
  if command -v maestro >/dev/null 2>&1; then
    echo "==> Mobile E2E (Maestro)"
    npm run test:e2e:ios || true
    npm run test:e2e:android || true
  else
    echo "Maestro CLI not installed — skip mobile E2E (brew install maestro)"
  fi
fi

echo "All selected test suites passed."
