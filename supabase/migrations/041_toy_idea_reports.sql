-- 041_toy_idea_reports.sql
-- WHY: making a design challenge participant uncomfortable needs a way to flag
--      it that the flagged person can never read. This is the storage behind
--      that report; exclusion and notification are handled in the API layer.

create table public.toy_idea_reports (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas on delete cascade,
  reported_profile_id uuid not null references public.profiles on delete cascade,
  reported_by uuid not null references public.profiles on delete cascade,
  -- Mandatory. The owner's call: a report with no account of what happened gives
  -- an admin nothing to act on and no pattern to compare against.
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles on delete set null,
  resolution_note text
);

alter table public.toy_idea_reports enable row level security;

-- No select policy for anon or authenticated, deliberately, and not an
-- oversight: this is the whole point of the table. A permissive RLS policy
-- set is OR'd together, and with none defined for a role every select by
-- that role returns zero rows regardless of what it is granted at the
-- column or table level (004's default privileges still grant it all).
-- That is unlike 040's toy_ideas fix, where anon/authenticated already had a
-- select policy making some rows visible and the leak was extra columns on
-- those visible rows. Here no row is ever visible to anon or authenticated,
-- so there is nothing for a column-level revoke to narrow — reports are
-- readable through the service role only.
create policy "Reporter files a report as the idea's author or a participant"
  on public.toy_idea_reports for insert to authenticated
  with check (
    reported_by = auth.uid()
    and (
      exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_reports.idea_id and p.profile_id = auth.uid()
      )
    )
  );

create policy "Admin full access to idea reports"
  on public.toy_idea_reports for all using (public.is_admin());

create index toy_idea_reports_idea_idx on public.toy_idea_reports (idea_id);
create index toy_idea_reports_reported_profile_idx on public.toy_idea_reports (reported_profile_id);
create index toy_idea_reports_unresolved_idx
  on public.toy_idea_reports (created_at) where resolved_at is null;
