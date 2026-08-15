-- supabase/migrations/029_drop_email_column_grant.sql
-- WHY: 028_pickup_column_grants.sql's column grant included `email` alongside
--      id/name/role/created_at, reasoning that the app-layer code only ever
--      read those five columns. But 023/024's anon-visible SELECT policies
--      (published-toy owner, approved-tutorial contributor, approved-tutorial
--      reviewer) make the underlying rows visible with no auth.uid() check,
--      and RLS is row-level only — once a row is visible, every granted
--      column on it is readable via a direct PostgREST call, regardless of
--      what any single route's .select() narrows to. A caller holding only
--      the public anon key can request `email` directly and get it, even
--      though no app route ever intended to expose it (they all select
--      `name` only from these embeds).
-- HOW: same table-level revoke + narrower column grant as 028 (Postgres
--      column-level REVOKE cannot subtract from a wider GRANT, so the whole
--      table has to be revoked and re-granted). The only legitimate email
--      readers — GET/PATCH /api/contributors/me, the collaborator-invite
--      lookup, GET /api/admin/contributors, and the admin-only email merge
--      on GET /api/tutorials/:id — all use the service-role admin client,
--      which bypasses grants entirely, so none of them are affected.
revoke select on public.profiles from anon, authenticated;
grant select (id, name, role, created_at)
  on public.profiles to anon, authenticated;
