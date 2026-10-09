#!/usr/bin/env bash
# Run Playwright e2e for one package with evidence kept outside the repo.
# Usage: e2e.sh web|mobile <spec path or --grep args...>     e.g.  e2e.sh web tests/e2e/public/library.spec.ts
# Env:   EVIDENCE_DIR (default ~/verify-evidence/splat-connect/<date>-<pkg>)  RUN_ID
# Refuses when: any e2e port (3102-3105) is already listening (Playwright would reuse a possibly stale
# server), or the other package's e2e is running (web+mobile share one local Supabase).
# Servers are started by Playwright's own webServer config (local Supabase, :3104/:3105 web, :3102/:3103 mobile)
# and torn down by it. Needs local Supabase on :54321 (supabase start).
set -u
PKG="${1:-}"; shift || true
case "$PKG" in web|mobile) ;; *) echo "usage: e2e.sh web|mobile <playwright args>"; exit 2;; esac
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for p in 3102 3103 3104 3105; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "REFUSED: :$p is already listening; Playwright would reuse it (stale-e2e-server-reuse). Run doctor.sh; stop it only if you started it."; exit 3
  fi
done
curl -s -m3 -o /dev/null localhost:54321/rest/v1/ || { echo "REFUSED: local Supabase is not on :54321 (supabase start)"; exit 3; }
EV="${EVIDENCE_DIR:-$HOME/verify-evidence/splat-connect/$(date +%F)-$PKG}"
mkdir -p "$EV"
cd "$ROOT/packages/$PKG" || exit 2
echo "evidence: $EV"
PLAYWRIGHT_JSON_OUTPUT_NAME="$EV/report.json" ./node_modules/.bin/playwright test "$@" \
  --trace=on --output="$EV/test-results" --reporter=line,json 2>&1 | tee "$EV/run.log"
RC=${PIPESTATUS[0]}
echo "exit $RC; report $EV/report.json; traces under $EV/test-results (npx playwright show-trace <trace.zip>)"
exit $RC
