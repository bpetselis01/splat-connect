#!/usr/bin/env bash
# PreToolUse hook (Bash): blocks pushes to main, force pushes and `git reset --hard`.
# The logic is in block-dangerous-git.py. Fails closed: with no python3 the guard cannot run, so it blocks.
command -v python3 >/dev/null 2>&1 || { echo "BLOCKED: python3 is missing, so the git guard cannot run." >&2; exit 2; }
exec python3 "$(dirname "${BASH_SOURCE[0]}")/block-dangerous-git.py"
