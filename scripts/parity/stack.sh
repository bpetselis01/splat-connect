#!/usr/bin/env bash
# Bring up the parity comparison stack on dedicated ports.
#
# Deliberately off both the dev ports (3100/3101) and the E2E ports
# (3104/3105): a shared port hands the comparison whatever server happens to be
# running, which is how a days-old build silently passes stale markup into a
# parity report. See project memory `stale-e2e-server-reuse`.
#
# Web runs `next dev`, not build+start, because this stack exists to be edited
# against — the parity loop changes CSS and pages between runs and needs HMR.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${PARITY_LOG_DIR:-/tmp/parity-logs}"
mkdir -p "$LOG_DIR"

API_PORT=3111
WEB_PORT=3110
ARTBOARD_PORT=8899

SUPABASE_URL='http://localhost:54321'
ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
SERVICE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

free_port() {
  local pid; pid="$(lsof -ti:"$1" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -9 $pid 2>/dev/null && echo "  freed :$1" || true
}

wait_for() {
  local url="$1" name="$2" tries="${3:-90}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf -o /dev/null --max-time 3 "$url"; then echo "  $name up"; return 0; fi
    sleep 2
  done
  echo "  $name FAILED — see $LOG_DIR"; return 1
}

case "${1:-up}" in
  down)
    for p in $API_PORT $WEB_PORT $ARTBOARD_PORT; do free_port "$p"; done
    ;;
  up)
    echo "Freeing ports..."
    for p in $API_PORT $WEB_PORT $ARTBOARD_PORT; do free_port "$p"; done

    echo "Artboard (static) :$ARTBOARD_PORT"
    (cd "$ROOT/Splat Connect frontend overhaul" && \
      nohup python3 -m http.server $ARTBOARD_PORT >"$LOG_DIR/artboard.log" 2>&1 &)

    echo "API :$API_PORT"
    (cd "$ROOT" && SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON_KEY="$ANON_KEY" \
      SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" API_PORT=$API_PORT PORT=$API_PORT \
      nohup pnpm --filter @splat-connect/api dev >"$LOG_DIR/api.log" 2>&1 &)

    echo "Web :$WEB_PORT"
    (cd "$ROOT" && NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
      NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
      SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
      API_URL="http://localhost:$API_PORT" NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" \
      PORT=$WEB_PORT \
      nohup pnpm --filter @splat-connect/web dev >"$LOG_DIR/web.log" 2>&1 &)

    wait_for "http://localhost:$ARTBOARD_PORT/support.js" "artboard" 15
    wait_for "http://localhost:$API_PORT/api/public/tutorials" "api" 60
    wait_for "http://localhost:$WEB_PORT/about" "web" 90
    ;;
  *) echo "usage: stack.sh [up|down]"; exit 1 ;;
esac
