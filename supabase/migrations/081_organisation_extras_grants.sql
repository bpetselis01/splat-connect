-- 081 — expose 076's organisation columns to the roles that read the public page.
--
-- 033 moved organizations to column-level grants and left a note that every new
-- column must be added to the list by hand. 076 added seven and did not, so a
-- signed-in or anonymous read naming any of them failed, and the API worked
-- around it through the service role. All seven are public by design — they are
-- what the public profile draws; the street address stays on the pickup columns,
-- which remain ungranted.
--
-- DOWN:
--   revoke select (kind, logo_url, cover_url, verified_at, visit_hours, service_area, payment_methods)
--     on public.organizations from anon, authenticated;

grant select (kind, logo_url, cover_url, verified_at, visit_hours, service_area, payment_methods)
  on public.organizations to anon, authenticated;
