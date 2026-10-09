#!/usr/bin/env bash
# Which checks does this change need? Reads git, prints the commands; --run executes the fast ones.
# Usage: scripts/verify-plan.sh [--run] [--e2e] [--since <ref>]
#   (default)  print the plan for uncommitted + untracked changes
#   --run      run typecheck and unit tests (no servers, no network)
#   --e2e      also run the matched Playwright specs, web then mobile, through scripts/e2e.sh
#   --since    diff against <ref> instead of the working tree (e.g. origin/development)
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT" || exit 2
RUN=0; E2E=0; SINCE=HEAD
while [ $# -gt 0 ]; do case "$1" in --run) RUN=1;; --e2e) E2E=1;; --since) SINCE="$2"; shift;; *) echo "unknown: $1"; exit 2;; esac; shift; done

CHANGED=$( { git diff --name-only "$SINCE"; [ "$SINCE" = HEAD ] && git ls-files -o --exclude-standard; } | sort -u)
[ -z "$CHANGED" ] && { echo "nothing changed against $SINCE"; exit 0; }
has() { echo "$CHANGED" | grep -qE "$1"; }
files() { echo "$CHANGED" | grep -E "$1" | grep -E '\.(ts|tsx)$' | grep -vE '/tests?/'; }

CMDS=(); E2ES=()
add() { CMDS+=("$1"); }

if has '^packages/types/'; then add "pnpm -r typecheck"; WEB=1; API=1; MOB=1; else WEB=0; API=0; MOB=0; fi
has '^packages/web/' && WEB=1; has '^packages/api/' && API=1; has '^packages/mobile/' && MOB=1
[ $WEB = 1 ] && add "pnpm --filter @splat-connect/web typecheck"
[ $API = 1 ] && add "pnpm --filter @splat-connect/api typecheck"
[ $MOB = 1 ] && add "pnpm --filter @splat-connect/mobile typecheck"
# vitest related finds the tests that import the changed files. Mobile runs the WHOLE jest (CLAUDE.md: a subset once missed a guard test).
if [ $WEB = 1 ]; then F=$(files '^packages/web/' | sed 's#^packages/web/##' | tr '\n' ' '); [ -n "$F" ] && add "cd packages/web && ./node_modules/.bin/vitest related --run $F"; fi
if [ $API = 1 ]; then F=$(files '^packages/api/' | sed 's#^packages/api/##' | tr '\n' ' '); [ -n "$F" ] && add "cd packages/api && ./node_modules/.bin/vitest related --run $F"; fi
[ $MOB = 1 ] && add "cd packages/mobile && npx jest"
has '^supabase/migrations/' && { add "pnpm db:check"; add "pnpm db:guards"; }
has '^packages/(types/src/pending\.ts)|^docs/PENDING\.md' && add "node scripts/pending.mjs --check"

# e2e: matched by name, not guessed. Mobile specs are prefixed by area (guides-*, challenges-*); web specs by route segment.
for f in $(echo "$CHANGED" | grep -E '^packages/mobile/(components|app)/'); do
  a=$(echo "$f" | awk -F/ '{print $4}'); a=${a%.tsx}; a=${a%.ts}
  for s in packages/mobile/tests/e2e/"$a"*.spec.ts; do [ -f "$s" ] && E2ES+=("mobile ${s#packages/mobile/}"); done
done
for f in $(echo "$CHANGED" | grep -E '^packages/web/app/'); do
  for seg in $(echo "$f" | sed 's#^packages/web/app/##; s#/[^/]*$##' | tr '/' ' ' | tr -d '[]()' ); do
    for s in $(grep -rlE "/$seg(['\"/?]|\b)" packages/web/tests/e2e --include='*.spec.ts' 2>/dev/null); do E2ES+=("web ${s#packages/web/}"); done
  done
done
E2ES=($(printf '%s\n' "${E2ES[@]:-}" | sort -u | sed 's/ /@/'))

echo "changed: $(echo "$CHANGED" | wc -l | tr -d ' ') files vs $SINCE"
echo "== fast checks"; for c in "${CMDS[@]:-}"; do [ -n "$c" ] && echo "  $c"; done
echo "== e2e (needs local Supabase; run web and mobile one after the other, never together)"
if [ ${#E2ES[@]} -eq 0 ] || [ -z "${E2ES[0]}" ]; then echo "  none matched by name — check by hand or write a spec"; else
  for e in "${E2ES[@]}"; do e=${e/@/ }; echo "  scripts/e2e.sh ${e%% *} ${e#* }"; done; fi
has '^packages/mobile/' && echo "== by hand: iOS-only layout (insets, sheets, lineHeight) is invisible to web tests; look on the simulator or phone"
[ $RUN = 0 ] && { echo; echo "(dry run: add --run to execute the fast checks, --e2e to add the specs)"; exit 0; }

FAIL=0
for c in "${CMDS[@]:-}"; do [ -z "$c" ] && continue; echo; echo ">>> $c"; ( eval "$c" ) || { echo "FAILED: $c"; FAIL=1; }; done
if [ $E2E = 1 ]; then for e in "${E2ES[@]:-}"; do [ -z "$e" ] && continue; e=${e/@/ }; echo; echo ">>> e2e $e"; scripts/e2e.sh ${e%% *} ${e#* } || { echo "FAILED: e2e $e"; FAIL=1; }; done; fi
echo; [ $FAIL = 0 ] && echo "ALL PASSED" || echo "SOME FAILED"; exit $FAIL
