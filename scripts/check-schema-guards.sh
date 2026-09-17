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
        and privilege_type = 'UPDATE')),

  -- 046. Not a security guard like the rows above, but the same failure shape:
  -- the ledger can read as applied while the constraint was never widened, and
  -- the only symptom is that every review-queue notification insert is rejected
  -- and logged — packages/api/src/review-notifications.ts swallows the error on
  -- purpose, so a leader is simply never told and nothing surfaces anywhere.
  ('046 notifications_type_check permits the review-queue types',
   (select pg_get_constraintdef(oid) like '%backing_requested%'
       and pg_get_constraintdef(oid) like '%tutorial_submitted%'
      from pg_constraint
     where conname = 'notifications_type_check'
       and conrelid = 'public.notifications'::regclass)),

  -- 053. Both photo buckets are public, and until 053 they had no size limit
  -- and no MIME allowlist — the only bound was /photo deleting every existing
  -- file before writing, which five-photo uploads removed. Without these the
  -- buckets accept arbitrary files of arbitrary size at a public URL, so their
  -- absence is a vulnerability rather than a bug, which is the bar for this
  -- list. storage.buckets is settings rather than DDL, so a repair that skips
  -- 053 leaves no other trace at all.
  ('053 photo buckets carry a size limit and an image-only MIME allowlist',
   (select count(*) = 2 from storage.buckets
      where id in ('toy-photos', 'toy-photos-library')
        and file_size_limit is not null
        and allowed_mime_types is not null
        and not (allowed_mime_types && array['text/html', 'image/svg+xml']))),

  -- 055 exchange_costs records what one family owes another. RLS off here does
  -- not break a feature, it publishes everybody's private financial
  -- arrangements to every signed-in account — which is the definition this
  -- file uses for "a guard whose absence is a vulnerability rather than a bug".
  ('055 exchange_costs has RLS enabled',
   (select coalesce(bool_and(relrowsecurity), false) from pg_class
      where relname = 'exchange_costs' and relnamespace = 'public'::regnamespace)),

  -- Four policies, one per verb. A permissive policy set is OR'd together, so
  -- a fifth that forgot its party check would silently widen all of them.
  ('055 exchange_costs has exactly its four policies',
   (select count(*) = 4 from pg_policies
      where schemaname = 'public' and tablename = 'exchange_costs')),

  -- The trigger enforces what the foreign keys cannot: that payer and payee are
  -- both parties to THIS exchange. Without it a leader can write a line naming
  -- two strangers, and the RLS policies would happily allow it.
  ('055 exchange_costs party trigger is present',
   (select count(*) > 0 from pg_trigger
      where tgname = 'exchange_costs_parties_match' and not tgisinternal)),

  ('056 exchange_settlements has RLS enabled',
   (select coalesce(bool_and(relrowsecurity), false) from pg_class
      where relname = 'exchange_settlements' and relnamespace = 'public'::regnamespace)),

  -- The one in this file with the worst failure mode. A receipt is often a
  -- photograph of somebody's bank statement; the bucket being public would
  -- publish them to anyone who can guess a transaction id, with no error
  -- anywhere and nothing in the product looking different.
  ('056 exchange-receipts bucket is private',
   (select coalesce(bool_and(not public), false) from storage.buckets
      where id = 'exchange-receipts')),

  -- Four verbs, each gated on being a party. 049 lets any signed-in account
  -- read a tutorial PDF, which is right for shared work and would be wrong
  -- here; if these are ever replaced by a signed-in-only policy the count
  -- stays the same, so the policy bodies are checked too.
  ('056 exchange-receipts policies all check the exchange party',
   (select count(*) = 4 from pg_policies
      where schemaname = 'storage'
        and policyname like '%exchange receipts%'
        and coalesce(qual, with_check) like '%is_toy_transaction_party%')),

  -- Same failure mode as the receipts bucket above, one step worse in one
  -- respect: a working shot is a photograph taken inside somebody's home, and
  -- a public bucket would publish it to anyone who can guess a transaction id
  -- with nothing in the product looking different.
  ('057 build-shots bucket is private',
   (select coalesce(bool_and(not public), false) from storage.buckets
      where id = 'build-shots')),

  ('057 build-shots policies all check the exchange party',
   (select count(*) = 4 from pg_policies
      where schemaname = 'storage'
        and policyname like '%build shots%'
        and coalesce(qual, with_check) like '%is_toy_transaction_party%')),

  -- Not a security guard but the one thing in 057 whose absence is silent: the
  -- shape constraint is what stops a build carrying a toy_id and a donation
  -- carrying a build_brief, and every read would then have to guess which of
  -- the two subjects it is looking at.
  ('057 toy_transactions_subject constraint is present',
   (select count(*) > 0 from pg_constraint
      where conrelid = 'public.toy_transactions'::regclass
        and conname = 'toy_transactions_subject')),

  -- 058. A printer row is a public offer and readable by design; what must not
  -- be public is the photo of somebody's finished parts, taken wherever their
  -- machine lives.
  ('058 print-shots bucket is private',
   (select coalesce(bool_and(not public), false) from storage.buckets
      where id = 'print-shots')),

  ('058 print-shots policies all check the exchange party',
   (select count(*) = 4 from pg_policies
      where schemaname = 'storage'
        and policyname like '%print shots%'
        and coalesce(qual, with_check) like '%is_toy_transaction_party%')),

  -- The write policy is the one that matters on this table: the select is
  -- `using (true)` on purpose, so an owner check that went missing would let
  -- anybody close somebody else's machine or point it at a different bed.
  ('058 printers has RLS enabled and an owner-gated write policy',
   (select coalesce(bool_and(relrowsecurity), false) from pg_class
      where relname = 'printers' and relnamespace = 'public'::regnamespace)
   and (select count(*) > 0 from pg_policies
      where tablename = 'printers'
        and cmd = 'ALL'
        and coalesce(qual, with_check) like '%is_org_leader%')),

  ('058 print_job_files has RLS enabled',
   (select coalesce(bool_and(relrowsecurity), false) from pg_class
      where relname = 'print_job_files' and relnamespace = 'public'::regnamespace)),

  -- 059. Credit is minted by the organisation weighing a drop-off, never by
  -- the contributor. The insert policy and the update policy are SEPARATE for
  -- that reason: one combined policy would let a contributor write their own
  -- `credit_grams`, and nothing in the product would look different.
  ('059 recycling_dropoffs update is gated on leading the organisation',
   (select count(*) > 0 from pg_policies
      where tablename = 'recycling_dropoffs'
        and cmd = 'UPDATE'
        and coalesce(qual, with_check) like '%is_org_leader%')),

  ('059 recycling_dropoffs insert does NOT admit a leader write',
   (select count(*) > 0 from pg_policies
      where tablename = 'recycling_dropoffs'
        and cmd = 'INSERT'
        and coalesce(with_check, qual) not like '%is_org_leader%')),

  -- A story cannot be published without consent for everyone named or
  -- pictured. A check constraint, not a checkbox: the constraint is what holds
  -- when somebody writes the row by any other route.
  ('059 org_stories_published_needs_consent constraint is present',
   (select count(*) > 0 from pg_constraint
      where conrelid = 'public.org_stories'::regclass
        and conname = 'org_stories_published_needs_consent')),

  -- 060. Leadership is granted by an admin and never self-started. A requester
  -- who could update their own row could set it to approved.
  ('060 organization_requests update is admin-only',
   (select count(*) > 0 from pg_policies
      where tablename = 'organization_requests'
        and cmd = 'UPDATE'
        and coalesce(qual, with_check) like '%is_admin%')
   and (select count(*) = 0 from pg_policies
      where tablename = 'organization_requests'
        and cmd = 'UPDATE'
        and coalesce(qual, with_check) like '%requester_id%')),

  ('060 approve_organization_request() checks is_admin() itself',
   (select count(*) > 0 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'approve_organization_request'
        and prosrc like '%is_admin()%')),

  -- 061. A registration carries a name, an email and free-text answers about a
  -- child's access and sensory needs. The artboard is explicit that "Answers
  -- are shown to leaders only", so there are exactly two ways to read one: you
  -- wrote it, or you lead the organisation running the event. A public-read
  -- policy here would put those answers on the open internet.
  ('061 org_event_registrations is never readable by anon',
   (select count(*) = 0 from pg_policies
      where tablename = 'org_event_registrations'
        and 'anon' = any(roles))),

  ('061 org_event_registrations read is own-row or org leader',
   (select count(*) = 0 from pg_policies
      where tablename = 'org_event_registrations'
        and cmd in ('SELECT', 'ALL')
        and coalesce(qual, with_check) not like '%auth.uid()%'
        and coalesce(qual, with_check) not like '%is_org_leader%')),

  -- The questions are public, and must stay scoped to a published, live event:
  -- an unscoped read would leak the shape of a draft or cancelled one.
  ('061 org_event_questions public read is scoped to a published event',
   (select count(*) > 0 from pg_policies
      where tablename = 'org_event_questions'
        and 'anon' = any(roles)
        and qual like '%published%')),

  -- A print request is done by a printer OR at an event, never both and never
  -- neither: a row naming both has no single party who can accept it, and the
  -- accept/decline buttons on two different screens would each half-own it.
  ('061 toy_transactions_subject requires exactly one print destination',
   (select count(*) > 0 from pg_constraint
      where conrelid = 'public.toy_transactions'::regclass
        and conname = 'toy_transactions_subject'
        and pg_get_constraintdef(oid) like '%num_nonnulls(printer_id, event_id) = 1%')),

  -- 064. An ownerless transaction is legal for exactly one shape: a build
  -- request nobody has claimed. Widen it by accident and a donation could be
  -- written with nobody responsible for handing the toy over, which every
  -- accept, confirm and handoff check reads as "not my row" and silently
  -- ignores.
  ('064 an ownerless transaction is an open build and nothing else',
   (select count(*) > 0 from pg_constraint
      where conrelid = 'public.toy_transactions'::regclass
        and conname = 'toy_transactions_one_owner'
        and pg_get_constraintdef(oid) like '%type = ''build''%'
        and pg_get_constraintdef(oid) like '%status = ''requested''%')),

  -- The Makers wanted board is signed-in. A public board of children's first
  -- names, ages and suburbs is not something to put behind no account at all,
  -- and the artboard's signed-out screen is an explainer for that reason.
  ('064 the open-build policy is never granted to anon',
   (select count(*) = 0 from pg_policies
      where tablename = 'toy_transactions'
        and policyname = 'toy_transactions_open_builds_readable'
        and 'anon' = any(roles)))
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
