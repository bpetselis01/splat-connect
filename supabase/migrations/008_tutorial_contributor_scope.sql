-- WHY: The tutorial_contributors INSERT policy (001_schema.sql:204) constrained only
--      profile_id, so any approved contributor could attach themselves to any
--      tutorial — including a stranger's private draft. Harmless-looking until
--      delegated review existed; combined with the org leader UPDATE grant added in
--      007 it became a path to PUBLISHING someone else's unsubmitted work:
--      self-attach, repin the draft into an org you belong to (which satisfies
--      the backing handshake, because you really do lead that organisation), then
--      ask an organisation you lead to back it, accept your own request, approve.
--      Reproduced end to end. With no self-review block (decision 14) a single
--      leader can do the whole chain alone, so this policy is the only thing
--      standing there.
-- HOW: A contributor may only claim a tutorial that has no contributors yet — which
--      is exactly the authoring path, since POST /api/tutorials inserts the row with
--      no link and the very next call (routes/contributors.ts) adds the author. Once
--      a tutorial has an owner, only an admin can add further contributors.
create or replace function public.tutorial_has_contributor(p_tutorial_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tutorial_contributors where tutorial_id = p_tutorial_id
  );
$$ language sql security definer stable set search_path = '';

drop policy "Approved contributors can insert" on public.tutorial_contributors;

create policy "Approved contributors can claim an unclaimed tutorial"
  on public.tutorial_contributors for insert
  with check (
    profile_id = auth.uid()
    and public.is_approved_contributor()
    and (
      not public.tutorial_has_contributor(tutorial_id)
      -- Retry safety, and it grants nothing: this arm only ever admits a row that
      -- duplicates one the caller already owns. Postgres evaluates a policy's
      -- WITH CHECK *before* the index insert, so without this arm a re-link would
      -- surface as 42501 instead of 23505 — and routes/contributors.ts swallows
      -- only 23505, which is what makes a half-failed submit safe to retry.
      or public.is_tutorial_contributor(tutorial_id)
    )
  );

-- WHY: tutorials.reviewed_by and reviewed_for_org_id are constrained by no policy,
--      so an author could rewrite their own review provenance on any non-approved
--      row of theirs, straight through PostgREST. Not an escalation —
--      status='approved' stays admin/leader-reserved — but it corrupts the audit
--      trail the admin spot-check of delegated reviews depends on.
-- HOW: A BEFORE trigger, gated on *change*
--      (`is distinct from`) so ordinary edits to title or parts are unaffected, and
--      SECURITY INVOKER with an empty search_path so every name is resolved here.
--      The `auth.uid() is null` arm is the service-role escape, and it is not a hole:
--      no RLS policy on tutorials admits a writer without an auth.uid() (they would
--      fail is_approved_contributor()), so a caller reaching this trigger with a null
--      uid is necessarily a BYPASSRLS server context — the admin client, which is how
--      POST /api/tutorials creates a row, or a migration. Same assumption 007 already
--      documents; it simply has to fail open here rather than closed.
create or replace function public.tutorials_freeze_review_provenance()
returns trigger as $$
begin
  if (
       case tg_op
         when 'INSERT' then new.reviewed_by is not null
                          or new.reviewed_for_org_id is not null
         else new.reviewed_by is distinct from old.reviewed_by
           or new.reviewed_for_org_id is distinct from old.reviewed_for_org_id
       end
     )
     and auth.uid() is not null
     and not public.is_admin()
     and not public.can_review_tutorial(new.id)
  then
    raise exception 'reviewed_by and reviewed_for_org_id may only be written by an admin or a backing org leader'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger tutorials_freeze_review_provenance
  before insert or update on public.tutorials
  for each row execute function public.tutorials_freeze_review_provenance();
