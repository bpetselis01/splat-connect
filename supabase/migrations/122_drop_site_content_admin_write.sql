-- 122 — site content is written through the API only.
--
-- 065's site_content_admin_write let an admin's own PostgREST session write
-- any row directly. Nothing in web or mobile does; the only writer is
-- PUT /api/admin/content/:key, through the service role (which RLS does not
-- apply to). Since Task 18 that route checks the Learn course outline
-- (readLearnCourse) and refuses a save over a version someone else saved
-- first (409). A direct write skipped both — an unreadable outline, or a
-- second admin silently laid over the first. With no write policy, RLS
-- refuses every insert, update and delete from anon and authenticated.
-- Reads are unchanged (site_content_public_read).
--
-- DOWN:
--   create policy site_content_admin_write
--     on public.site_content for all to authenticated
--     using (public.is_admin())
--     with check (public.is_admin());

drop policy if exists site_content_admin_write on public.site_content;
