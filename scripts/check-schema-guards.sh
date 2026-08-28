#!/usr/bin/env bash
# Fails if a security-critical database object is missing from the linked remote.
#
# check-migration-drift.sh compares the migration LEDGER; this compares the
# actual schema. The two catch different failures, and the second one is why
# this script exists:
#
#   - unpushed migration  -> ledger is missing a row  -> drift check catches it;
#   - `supabase migration repair --status applied X` -> ledger row is written,
#     with X's statements recorded verbatim, but the SQL never executes. The
#     drift check sees a complete ledger and passes.
#
# The second is not hypothetical. On 2026-08-28 a pentest escalated an ordinary
# account to admin against the cloud project because profiles_freeze_identity
# was absent while 009 read as applied — and the tell was that
# is_approved_contributor() still had its pre-009 body. Nothing in CI could see
# it. These assertions can.
#
# Add a row below whenever a migration introduces a guard whose absence is a
# vulnerability rather than a bug: a freeze trigger, an is_admin() gate, a
# revoked grant.
#
# Usage: bash scripts/check-schema-guards.sh
# Requires: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF.
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

# Each row: a label, and a SQL predicate that must be true on a healthy remote.
# Kept as one round trip rather than one request per assertion.
read -r -d '' SQL <<'EOSQL' || true
select * from (values
  ('009 profiles_freeze_identity trigger',
   (select count(*) > 0 from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'profiles_freeze_identity'
        and not tgisinternal)),

  ('009 freeze_profile_identity() function',
   (select count(*) > 0 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'freeze_profile_identity')),

  -- The canary that exposed the repaired-but-never-run 009: the pre-009 body
  -- required role = 'contributor', which 009 removes.
  ('009 is_approved_contributor() has its post-009 body',
   (select count(*) = 0 from pg_proc
      where proname = 'is_approved_contributor'
        and prosrc like '%role%=%contributor%')),

  ('007 tutorial_orgs_freeze_identity trigger',
   (select count(*) > 0 from pg_trigger
      where tgname = 'tutorial_orgs_freeze_identity' and not tgisinternal)),

  ('008 tutorials_freeze_review_provenance trigger',
   (select count(*) > 0 from pg_trigger
      where tgname = 'tutorials_freeze_review_provenance' and not tgisinternal)),

  ('018 tutorial_collaborator_invites_freeze_identity trigger',
   (select count(*) > 0 from pg_trigger
      where tgname = 'tutorial_collaborator_invites_freeze_identity'
        and not tgisinternal)),

  -- 045. The escalation stays closed even if the trigger is dropped again.
  -- Other profiles columns are legitimately UPDATE-grantable (045 grants back
  -- contributors.ts's EDITABLE allowlist); these two never are.
  ('045 profiles.role/email UPDATE is not granted to anon/authenticated',
   (select count(*) = 0 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'profiles'
        and column_name in ('role', 'email')
        and grantee in ('anon', 'authenticated')
        and privilege_type = 'UPDATE'))
) as t(guard, ok)
where not ok;
EOSQL

payload=$(SQL="$SQL" python3 -c 'import json, os; print(json.dumps({"query": os.environ["SQL"]}))')

response=$(curl -sS -X POST \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload")

# A failed assertion and a failed request both need to fail the build, and the
# error shape differs from the result shape, so tell them apart explicitly
# rather than letting a non-list response read as "no missing guards".
missing=$(printf '%s' "$response" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("QUERY_FAILED: " + raw[:400]); sys.exit(0)
if not isinstance(data, list):
    print("QUERY_FAILED: " + json.dumps(data)[:400]); sys.exit(0)
print("\n".join(row["guard"] for row in data))
')

if [ -n "$missing" ]; then
  echo "✗ Schema guards missing or unverifiable on project ${SUPABASE_PROJECT_REF}:" >&2
  printf '%s\n' "$missing" | sed 's/^/    /' >&2
  echo >&2
  echo "  A migration is recorded as applied but its objects are absent." >&2
  echo "  Do NOT 'migration repair' this away — that is what caused it." >&2
  echo "  Run: supabase db push" >&2
  exit 1
fi

echo "✓ All security-critical schema guards are present on the remote database."
