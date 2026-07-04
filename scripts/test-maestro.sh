#!/usr/bin/env bash
# scripts/test-maestro.sh
# Runs Maestro flows for a given platform: ios | android | all
set -euo pipefail

PLATFORM="${1:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v maestro >/dev/null 2>&1; then
  echo "Maestro CLI required. Install: curl -Ls 'https://get.maestro.mobile.dev' | bash"
  exit 1
fi

APP_ID="${APP_ID:-hu.invohub.app}"
export APP_ID

run_ios() {
  echo "==> Maestro iOS"
  maestro test e2e/maestro/flows --platform ios
}

run_android() {
  echo "==> Maestro Android"
  maestro test e2e/maestro/flows --platform android
}

case "$PLATFORM" in
  ios) run_ios ;;
  android) run_android ;;
  all)
    run_ios
    run_android
    ;;
  *)
    echo "Usage: $0 [ios|android|all]"
    exit 1
    ;;
esac
