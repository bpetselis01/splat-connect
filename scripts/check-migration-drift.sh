#!/usr/bin/env bash
# Fails if any committed migration has not been applied to the linked remote DB.
#
# Catches the "merged the migration but forgot `supabase db push`" gap: on
# 2026-08-18, migrations 032 and 033 were committed and coded against, but never
# pushed — so toys.owner_org_id was missing in production and the Toy Library and
# Exchanges pages 500'd. This is the guard that would have caught it.
#
# Usage: bash scripts/check-migration-drift.sh   (requires a linked project)
set -euo pipefail

# The CLI may prefix banner lines; start at the first line of JSON.
pending=$(supabase migration list --linked --output-format json 2>/dev/null \
  | sed -n '/^[[{]/,$p' \
  | jq -r '(if type == "array" then . else .migrations end) // [] | .[]
           | select(.local and (.remote | not)) | .local')

if [ -n "$pending" ]; then
  echo "✗ Migrations committed but NOT applied to the remote database:" >&2
  printf '    %s\n' $pending >&2
  echo >&2
  echo "  Run: supabase db push" >&2
  exit 1
fi

echo "✓ All committed migrations are applied to the remote database."
