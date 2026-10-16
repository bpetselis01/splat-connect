#!/usr/bin/env bash
# Read-only. Answers "is this machine worth driving right now?" Starts and kills nothing.
# Usage: .claude/skills/verify/scripts/doctor.sh        (exit 0 = no FAIL lines, 1 = at least one)
# Lines: OK / INFO / WARN / FAIL. A WARN or FAIL names the memory note that explains it.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2
FAILS=0
ok()   { echo "OK    $*"; }
info() { echo "INFO  $*"; }
warn() { echo "WARN  $*"; }
fail() { echo "FAIL  $*"; FAILS=$((FAILS+1)); }

HEAD_TS=$(git log -1 --format=%ct)
echo "== repo: HEAD $(git rev-parse --short HEAD) ($(git log -1 --format=%cd --date=format:'%b %d %H:%M')), branch $(git branch --show-current)"
D=$(git status --short | wc -l | tr -d ' '); [ "$D" != 0 ] && info "$D uncommitted file(s): a build older than these is stale for them even if newer than HEAD"

# --- ports: who owns each, since when, started from which dir
listener() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -Fp 2>/dev/null | sed -n 's/^p//p' | head -1; }
pid_cwd()  { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'; }
pid_start(){ ps -o lstart= -p "$1" | sed 's/^ *//; s/ *$//'; }
pid_epoch(){ date -j -f '%a %b %e %T %Y' "$(pid_start "$1")" +%s 2>/dev/null; }
pid_env()  { ps eww -p "$1" 2>/dev/null | tr ' ' '\n' | sed -n "s/^$2=//p" | head -1; }

echo "== ports"
check_port() { # port label kind(dev|e2e|static|other)
  local p="$1" label="$2" kind="$3" pid cwd t
  pid=$(listener "$p")
  if [ -z "$pid" ]; then info ":$p free ($label)"; return; fi
  cwd=$(pid_cwd "$pid"); [ "$cwd" = "$ROOT" ] && cwd=. ; cwd=${cwd#"$ROOT"/}
  info ":$p $label -> pid $pid, started $(pid_start "$pid"), cwd ${cwd:-?}"
  case "$cwd" in /*) warn ":$p was started outside this checkout ($cwd): do not drive it";; esac
  t=$(pid_epoch "$pid")
  if [ "$kind" = e2e ] || [ "$kind" = static ]; then
    if [ -n "$t" ] && [ "$t" -lt "$HEAD_TS" ]; then
      fail ":$p ($label) started BEFORE HEAD commit: Playwright reuseExistingServer would test an old build. Stop it (kill pid $pid only if you started it) [stale-e2e-server-reuse]"
    else ok ":$p ($label) is newer than HEAD"; fi
  fi
  [ "$p" = 8100 ] && { curl -s -m3 localhost:8100/status >/dev/null && ok ":8100 WDA answers" || warn ":8100 forward is up but WDA does not answer (dead forward); iphone-qa stop && iphone-qa start, or use 100.67.126.85:8100 [iphone-mobile-mcp-setup]"; return; }
  u=$(pid_env "$pid" SUPABASE_URL); [ -z "$u" ] && u=$(pid_env "$pid" NEXT_PUBLIC_SUPABASE_URL); [ -z "$u" ] && u=$(pid_env "$pid" EXPO_PUBLIC_SUPABASE_URL)
  [ -z "$u" ] && [ "$kind" = dev ] && info ":$p env is not visible in ps; dev servers read the HOSTED .env.local files listed below"
  [ -n "$u" ] && { case "$u" in *localhost*|*127.0.0.1*) ok ":$p backend = LOCAL ($u)";; *) warn ":$p backend = HOSTED ($u): read-only driving only [supabase-project-topology]";; esac; }
}
check_port 3100 "web dev" dev
check_port 3101 "api dev" dev
check_port 3102 "mobile-e2e api" e2e
check_port 3103 "mobile-e2e web export" e2e
check_port 3104 "web-e2e api" e2e
check_port 3105 "web-e2e web build" e2e
check_port 3110 "parity web (next dev)" other
check_port 3111 "parity api" other
check_port 3112 "parity mobile export (static, never self-refreshes)" static
check_port 8899 "parity artboard" other
check_port 8100 "WebDriverAgent forward (real iPhone)" other

if [ -n "$(listener 3100)" ] && [ -n "$(listener 3110)" ]; then warn "two next dev servers up: check which one you are reading [turbopack-serves-stale-css]"; fi
[ -n "$(listener 3101)" ] && [ -z "$(listener 3111)" ] && : # dev API normally hosted; env file check below

# e2e web bundle age (next start serves .next from disk)
if [ -f packages/web/.next/BUILD_ID ]; then
  B=$(stat -f %m packages/web/.next/BUILD_ID)
  [ "$B" -lt "$HEAD_TS" ] && warn "packages/web/.next build is older than HEAD (a reused :3105 server serves it) [stale-e2e-server-reuse]" || ok "packages/web/.next build is newer than HEAD"
fi
[ -d packages/web/.next-parity ] && warn "packages/web/.next-parity exists: rm -rf it (with :3110 stopped) before web e2e, a corrupt link.d.ts fails next build [device-build-and-parity-gotchas]"

echo "== Metro (:8081)"
MP=$(listener 8081)
if [ -z "$MP" ]; then info "no Metro; start detached, see SKILL.md Launch"; else
  S=$(curl -s -m3 localhost:8081/status); C=$(pid_cwd "$MP")
  [ "$S" = "packager-status:running" ] && ok "Metro answers /status" || fail "pid $MP owns :8081 but /status said '$S'"
  [ "$C" = "$ROOT/packages/mobile" ] && ok "Metro cwd is this checkout's packages/mobile" || fail "Metro cwd is '$C', not $ROOT/packages/mobile: wrong Metro, it bundles other code"
  ps -o command= -p "$MP" | grep -q -- '--dev-client' && info "Metro runs --dev-client (dev client loads JS from it; if Metro dies the app looks crashed) [dev-servers-detached]" || warn "Metro is not --dev-client"
  [ "$(pid_epoch "$MP")" ] && info "Metro started $(pid_start "$MP"); it inherits the HOSTED .env.local unless started with inline EXPO_PUBLIC_* [expo-dev-bundle-hosted-env]"
fi

echo "== backend env (files; a dev server reads these, an e2e server overrides them)"
for f in .env.local packages/api/.env.local packages/mobile/.env.local packages/web/.env.local; do
  [ -f "$f" ] || continue
  u=$(grep -E '^(EXPO_PUBLIC_)?(NEXT_PUBLIC_)?SUPABASE_URL=' "$f" | head -1 | cut -d= -f2-)
  [ -z "$u" ] && u=$(grep -E 'SUPABASE_URL=' "$f" | head -1 | cut -d= -f2-)
  [ -z "$u" ] && continue
  case "$u" in *localhost*|*127.0.0.1*) ok "$f -> LOCAL $u";; *) warn "$f -> HOSTED $u (the live 'development' project, real PII; never write to it) [supabase-project-topology]";; esac
done
code=$(curl -s -m3 -o /dev/null -w '%{http_code}' localhost:54321/rest/v1/)
case "$code" in 200|401|404) ok "local Supabase answers on :54321 (HTTP $code); e2e and parity use this";; *) warn "local Supabase not answering on :54321 (HTTP $code): e2e cannot run. supabase start";; esac

echo "== iOS simulator / device"
SIM=$(xcrun simctl list devices booted 2>/dev/null | sed -n 's/^ *\(.*\) (\([0-9A-F-]\{36\}\)) (Booted).*/\1 \2/p' | head -1)
if [ -n "$SIM" ]; then ok "booted simulator: $SIM"
  xcrun simctl listapps booted 2>/dev/null | grep -q com.splatconnect.mobile && ok "com.splatconnect.mobile installed" || warn "app not installed on the booted simulator (dev:mobile builds it)"
else info "no simulator booted"; fi
PL=packages/mobile/ios/mobile/Info.plist
if [ -f "$PL" ]; then
  NT=$(git log -1 --format=%ct -- packages/mobile/package.json packages/mobile/app.json packages/mobile/app.config.ts)
  [ "$(stat -f %m "$PL")" -lt "$NT" ] && warn "ios/ prebuild is older than the last package.json/app.json commit: new native modules crash until 'npx expo prebuild -p ios' [stale-ios-prebuild-dir]" || ok "ios/ prebuild is newer than the last native-config commit"
else info "no packages/mobile/ios (gitignored; prebuild creates it)"; fi
command -v maestro >/dev/null && ok "maestro present" || warn "maestro missing"
[ -d /opt/homebrew/opt/openjdk@17 ] && ok "JDK 17 present (export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home before maestro)" || warn "JDK 17 missing: maestro fails on the system Java 11 [mobile-hermes-runtime-parity]"
TS=$(tailscale ip -4 2>/dev/null | head -1)
if [ -n "$TS" ]; then
  grep -q "$TS" packages/web/next.config.ts && ok "tailscale $TS is in allowedDevOrigins" || warn "tailscale $TS missing from packages/web/next.config.ts allowedDevOrigins: hydration dies on that host [next-dev-tailscale-origin]"
else info "tailscale not up"; fi

echo "== static guards for known traps"
H=$(grep -rlE "from '(\.\./)+(\.\./)?(components|app)/|from '@/components" packages/web/tests/e2e packages/mobile/tests/e2e 2>/dev/null)
[ -n "$H" ] && fail "e2e spec imports a component (Playwright's Node loader cannot load ESM-only deps; the whole suite stops loading): $H [e2e-specs-import-no-components]" || ok "no e2e spec imports from components/"
grep -nE "command:.*pnpm" packages/web/playwright.config.ts packages/mobile/playwright.config.ts && fail "pnpm inside a Playwright webServer command: teardown orphans the server and CI hangs [playwright-webserver-pnpm-hang]" || ok "webServer commands call binaries directly"
grep -rnE "SecureStore\.(get|set|delete)ItemAsync\(\s*['\`\"][^'\`\"]*:" packages/mobile --include=*.ts --include=*.tsx --exclude-dir=node_modules 2>/dev/null | head -3 | grep . && fail "SecureStore key with ':' (iOS rejects it silently) [securestore-key-charset]" || ok "no literal SecureStore key contains ':'"

echo "== summary: $FAILS FAIL"
[ "$FAILS" = 0 ]
