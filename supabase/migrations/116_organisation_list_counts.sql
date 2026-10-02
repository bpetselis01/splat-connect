-- 116 — what an organisation stands behind, as counts on the directory
-- (organisations-list-meta).
--
-- The board's row reads "Newcastle, NSW · 18 backed · 7 toys", or "· has a
-- printer". Three numbers per row, so three SECURITY DEFINER computed fields
-- rather than three fetches per organisation, and never counter columns:
--
--   org_backed_count  accepted backings on approved guides (what the profile's
--                     "Guides they back" lists)
--   org_toy_count     published toys on its shelf
--   org_has_printer   an accepting printer it owns
--
-- Each discloses a number anyone could count off the public profile, but no
-- client calls them: a computed field takes the whole row, and 033/059 grant
-- anon only named columns of organizations, so PostgREST refuses the anon
-- select ("permission denied for table organizations"). GET
-- /api/public/organizations reads the three through the admin client and
-- merges them by id, so execute stays with service_role alone.
--
-- DOWN:
--   drop function if exists public.org_has_printer(public.organizations);
--   drop function if exists public.org_toy_count(public.organizations);
--   drop function if exists public.org_backed_count(public.organizations);

create function public.org_backed_count(o public.organizations)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
    from public.tutorial_orgs b
    join public.tutorials t on t.id = b.tutorial_id
   where b.org_id = o.id and b.status = 'accepted' and t.status = 'approved'
$$;

create function public.org_toy_count(o public.organizations)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.toys where owner_org_id = o.id and status = 'published'
$$;

create function public.org_has_printer(o public.organizations)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.printers where owner_org_id = o.id and accepting)
$$;

revoke execute on function public.org_backed_count(public.organizations) from public, anon, authenticated;
revoke execute on function public.org_toy_count(public.organizations) from public, anon, authenticated;
revoke execute on function public.org_has_printer(public.organizations) from public, anon, authenticated;
