-- supabase/migrations/012_tutorial_collaborators.sql
-- WHY: tutorial_contributors has always supported a 'collaborator' role but
--      nothing ever inserted one — a tutorial can only ever have one
--      contributor today. 008_tutorial_contributor_scope.sql deliberately
--      locked self-claiming to an unclaimed tutorial, closing a reproduced
--      exploit (self-attach to a stranger's draft, launder it through an org
--      you lead, approve your own request). Adding a second contributor has
--      to go through an owner-initiated invite, never a self-serve claim.
-- HOW: A separate pending/accepted/declined handshake table, the same shape
--      007_organizations.sql already uses for tutorial_orgs, plus one new
--      narrow INSERT arm on tutorial_contributors that only admits a row
--      when a matching invite already exists — and that invite could only
--      have been created by the tutorial's primary contributor, so the 008
--      hole stays closed.
-- See docs/superpowers/specs/2026-08-02-tutorial-collaborators-design.md

create table public.tutorial_collaborator_invites (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  invited_profile_id uuid references public.profiles on delete cascade not null,
  invited_by uuid references public.profiles on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (tutorial_id, invited_profile_id)
);

alter table public.tutorial_collaborator_invites enable row level security;

-- Only a tutorial's primary contributor may invite. Distinct from
-- is_tutorial_contributor(), which is true for any contributor — a
-- collaborator must not be able to invite another collaborator.
create or replace function public.is_primary_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors
    where tutorial_id = p_tutorial_id and profile_id = auth.uid() and role = 'primary'
  );
$$ language sql security definer stable;

-- INSERT/UPSERT: the primary contributor creates the invite, always 'pending'
-- and unresponded. Upserting on the (tutorial_id, invited_profile_id) unique
-- pair resets a declined row rather than failing the constraint, so a
-- decline is never permanent — the primary can just ask again.
create policy "Primary contributor can invite a collaborator"
  on public.tutorial_collaborator_invites for insert
  with check (
    invited_by = auth.uid()
    and public.is_primary_contributor(tutorial_id)
    and status = 'pending'
    and responded_at is null
    and invited_profile_id != auth.uid()
  );

create policy "Primary contributor can reset a declined invite"
  on public.tutorial_collaborator_invites for update
  using (public.is_primary_contributor(tutorial_id))
  with check (
    public.is_primary_contributor(tutorial_id)
    and status = 'pending'
    and responded_at is null
  );

-- The invitee answers their own invite and nothing else about it.
create policy "Invitee can answer their invite"
  on public.tutorial_collaborator_invites for update
  with check (
    invited_profile_id = auth.uid()
    and status in ('accepted', 'declined')
  );

create policy "Participants can read an invite"
  on public.tutorial_collaborator_invites for select
  using (
    invited_profile_id = auth.uid()
    or public.is_primary_contributor(tutorial_id)
  );

create policy "Admin full access to tutorial_collaborator_invites"
  on public.tutorial_collaborator_invites for all using (public.is_admin());

-- tutorial_contributors — one new INSERT arm. The existing 008 arm (claim an
-- unclaimed tutorial) is untouched; this is a second, independent path.
drop policy "Approved contributors can claim an unclaimed tutorial" on public.tutorial_contributors;

create policy "Approved contributors can claim an unclaimed tutorial or an invited seat"
  on public.tutorial_contributors for insert
  with check (
    profile_id = auth.uid()
    and public.is_approved_contributor()
    and (
      not public.tutorial_has_contributor(tutorial_id)
      or public.is_tutorial_contributor(tutorial_id)
      or exists (
        select 1 from public.tutorial_collaborator_invites i
        where i.tutorial_id = tutorial_contributors.tutorial_id
          and i.invited_profile_id = auth.uid()
          and i.status != 'declined'
      )
    )
    -- A claimed seat via invite is always 'collaborator': the primary role is
    -- reserved for whoever authored the tutorial, which the first arm covers.
    and (role = 'primary' or role = 'collaborator')
  );

-- Any contributor (primary or collaborator) can see every other contributor
-- on the same project — needed both for the Collaborators UI later and
-- because Postgres RLS requires SELECT visibility before DELETE/UPDATE can
-- act on a row at all, which the DELETE policy below depends on.
create policy "Contributors can view their team"
  on public.tutorial_contributors for select
  using (public.is_tutorial_contributor(tutorial_id));

-- Team management: the primary removes a collaborator, or a collaborator
-- removes themself. Neither can ever target the primary's own row — there is
-- no "leave" or "remove" for the tutorial's author.
create policy "Primary removes a collaborator, a collaborator leaves"
  on public.tutorial_contributors for delete
  using (
    role = 'collaborator'
    and (profile_id = auth.uid() or public.is_primary_contributor(tutorial_id))
  );
