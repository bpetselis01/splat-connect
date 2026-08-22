-- 042_participant_removal.sql
-- WHY: an author could remove a participant and that person rejoined one
--      click later, reading the entire thread -- removal existed, worked, and
--      meant nothing. Removal now marks the row instead of deleting it, since
--      a deleted row cannot bar a return. Every read of toy_idea_participants
--      must therefore filter removed_at is null, and thread reads are bounded
--      to what a participant could actually have seen since they joined.

alter table public.toy_idea_participants
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles on delete set null;

-- A plain "exists (select 1 from toy_idea_participants ...)" here would have
-- the insert policy query its own table, which Postgres refuses with
-- "infinite recursion detected in policy" -- same cycle 001's comment on
-- tutorial_is_approved describes, broken the same way: a security definer
-- function that reads the table without going back through its own RLS.
create or replace function public.has_idea_participant_row(p_idea_id uuid, p_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.toy_idea_participants
    where idea_id = p_idea_id and profile_id = p_profile_id
  );
$$ language sql security definer stable;

-- A removed person still carries a row keyed on (idea_id, profile_id), so the
-- primary key alone would bar a second insert -- but this states the refusal
-- explicitly, as an RLS check the API can recognise (42501), rather than
-- leaking a raw constraint violation as an opaque 500.
drop policy "Anyone may join a published challenge" on public.toy_idea_participants;
create policy "Anyone may join a published challenge"
  on public.toy_idea_participants for insert to authenticated
  with check (
    profile_id = auth.uid()
    and not public.has_idea_participant_row(idea_id, auth.uid())
    and exists (
      select 1 from public.toy_ideas i
      where i.id = idea_id and i.status = 'challenge' and i.author_id <> auth.uid()
    )
  );

-- Removed people are not participants of the challenge any more, and must not
-- be listed as one on a public brief -- that is precisely the harm removal
-- exists to prevent.
drop policy "Participants of public challenges are visible" on public.toy_idea_participants;
create policy "Participants of public challenges are visible"
  on public.toy_idea_participants for select to anon, authenticated
  using (
    removed_at is null
    and exists (
      select 1 from public.toy_ideas i
      where i.id = idea_id and i.status in ('challenge', 'graduated')
    )
  );

-- Thread history is bounded to what a participant could actually have seen:
-- a removed row reads nothing, and a current one reads only messages from
-- joined_at onward. A parent's early detail about their child should not be
-- readable by someone who joins months later. The author is exempt from both
-- limits -- they authored the brief and are never a participant row.
drop policy "Author and participants read the thread" on public.toy_idea_messages;
create policy "Author and participants read the thread"
  on public.toy_idea_messages for select to authenticated
  using (
    exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
    or exists (
      select 1 from public.toy_idea_participants p
      where p.idea_id = toy_idea_messages.idea_id
        and p.profile_id = auth.uid()
        and p.removed_at is null
        and toy_idea_messages.created_at >= p.joined_at
    )
  );

-- No time bound needed on posting -- a message is always written now, which
-- is always after joined_at. removed_at is null is what actually matters:
-- a removed person must not be able to keep talking in a thread they no
-- longer belong to.
drop policy "Author and participants post to the thread" on public.toy_idea_messages;
create policy "Author and participants post to the thread"
  on public.toy_idea_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_messages.idea_id
          and p.profile_id = auth.uid()
          and p.removed_at is null
      )
    )
  );

-- 041's report-insert policy checked only that a participant row existed --
-- correct when written, since removed_at did not exist yet. Now that a
-- removed person keeps their row, that check alone would let them file a
-- report against the very challenge that excluded them. Same fix as above:
-- require removed_at is null.
drop policy "Reporter files a report as the idea's author or a participant" on public.toy_idea_reports;
create policy "Reporter files a report as the idea's author or a participant"
  on public.toy_idea_reports for insert to authenticated
  with check (
    reported_by = auth.uid()
    and (
      exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_reports.idea_id
          and p.profile_id = auth.uid()
          and p.removed_at is null
      )
    )
  );
