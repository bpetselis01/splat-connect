-- WHY: Newer Supabase defaults stop auto-exposing tables to the Data API roles
--      (anon / authenticated / service_role). Local stacks generated with a
--      current CLI have NO grants on public tables, so every PostgREST call —
--      and therefore every API route and integration test — fails with
--      "permission denied" (42501). The legacy auto-expose flag is deprecated
--      and removed 2026-10-30, so explicit grants are the durable fix.
-- HOW: Grants let requests reach the tables; row-level security policies
--      (001_schema.sql) remain the actual access-control layer, exactly as on
--      the cloud project. On databases that already have these grants (the
--      cloud DB, created under the old default), every statement is an
--      idempotent no-op. Default privileges cover tables added by future
--      migrations so they are exposed without repeating this.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines  to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
