-- 139 — An acceptance counts only at the current version of the terms.
--
-- 007 made has_accepted deliberately version-agnostic: any row of the type
-- counted. That made AGREEMENT_VERSIONS (packages/types/src/index.ts) a label
-- and nothing more: bumping it when the lawyer-reviewed terms land would have
-- re-asked nobody, and the v0-todo acceptances, which are void, would have
-- kept their review grants. Now has_accepted asks for the current version.
--
-- current_agreement_version must say what AGREEMENT_VERSIONS says. The API
-- writes the version from AGREEMENT_VERSIONS and the policies read it from here;
-- tests/integration/orgs/agreements.test.ts fails when the two differ. Bump
-- both together, in a new migration.
--
-- DOWN:
--   restore 007's has_accepted; drop function public.current_agreement_version(text)

create or replace function public.current_agreement_version(p_agreement_type text)
returns text as $$
  select case p_agreement_type
    when 'contributor_terms' then 'v0-todo'
    when 'org_leader_terms'  then 'v0-todo'
  end;
$$ language sql immutable;

create or replace function public.has_accepted(p_agreement_type text)
returns boolean as $$
  select exists (
    select 1 from public.user_agreements
    where user_id = auth.uid()
      and agreement_type = p_agreement_type
      and version = public.current_agreement_version(p_agreement_type)
  );
$$ language sql security definer stable set search_path = '';
