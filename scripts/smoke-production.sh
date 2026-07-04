#!/usr/bin/env bash
# scripts/smoke-production.sh
# Poll production until health + home page respond (post-deploy smoke).
set -euo pipefail

BASE_URL="${PRODUCTION_BASE_URL:-https://invohub.vercel.app}"
MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-20}"
SLEEP_SECONDS="${SMOKE_SLEEP_SECONDS:-15}"

echo "Production smoke: ${BASE_URL}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Attempt ${attempt}/${MAX_ATTEMPTS}..."

  health_code="$(curl -s -o /tmp/invohub-health.json -w "%{http_code}" "${BASE_URL}/api/health" || true)"
  home_code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" || true)"

  if [ "$health_code" = "200" ] && [ "$home_code" = "200" ]; then
    echo "Health:"
    cat /tmp/invohub-health.json
    echo
    echo "Production smoke passed."
    exit 0
  fi

  echo "  health=${health_code} home=${home_code} — retrying in ${SLEEP_SECONDS}s"
  sleep "$SLEEP_SECONDS"
done

echo "Production smoke failed after ${MAX_ATTEMPTS} attempts."
exit 1
