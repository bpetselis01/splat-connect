-- supabase/migrations/028_pickup_column_grants.sql
-- WHY: 023_public_profile_names.sql's "anyone can view the owner name of a
--      published toy" policy has no auth.uid() check, so it matches anon
--      too, and 026's "transaction parties can view each other's name"
--      policy has no status/role scoping either. RLS is row-level only —
--      once either policy makes a profiles row visible, every column on
--      that row is visible to the matching role, regardless of what any
--      single route's .select() narrows to. 025_toy_exchange_columns.sql
--      added pickup_line1/suburb/state/postcode as plain columns on that
--      same table, so they leak to anyone who owns a published toy or
--      shares a transaction with the profile's owner, via a direct
--      PostgREST call the app-layer code never authorized.
-- HOW: 004_data_api_grants.sql grants `select` at the TABLE level, and
--      Postgres column-level REVOKE cannot subtract from a table-level
--      GRANT — a revoke on the four pickup columns alone is a no-op while
--      that table grant stands. The only fix is to revoke SELECT on the
--      whole table, then grant back exactly the columns anon/authenticated
--      actually read: id/name/email/role/created_at (auth.ts, api-core.ts,
--      login/page.tsx, and the toy-transactions PostgREST embeds all read
--      only these). The only legitimate pickup_* readers are unaffected:
--      GET /api/contributors/me and the accept handler in
--      toy-transactions.ts both use the service-role admin client, which
--      bypasses grants entirely, and the accepted counterparty's address
--      is already copied onto toy_transactions.pickup_* (its own,
--      correctly scoped RLS policy) rather than read off profiles
--      directly.
revoke select on public.profiles from anon, authenticated;
grant select (id, name, email, role, created_at)
  on public.profiles to anon, authenticated;
