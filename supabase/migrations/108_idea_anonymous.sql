-- 108 — post an idea anonymously (idea-anonymous).
--
-- The public brief leaves the author off when this is set; admins and the
-- author still see them. Hiding the name alone would not hide the author: 040
-- granted anon author_id, and a profile id is a name one call away.
--
-- Controller ruling 2: anonymity holds for signed-in readers too, so
-- author_id leaves BOTH anon and authenticated. authenticated held 037's
-- table-wide select; it is revoked and every other column granted back by
-- name. A column added to toy_ideas from here on is not readable by
-- authenticated until a migration grants it.
--
-- Five policies on other tables sub-selected toy_ideas.author_id and would
-- fail with "permission denied for table toy_ideas" once the column is gone
-- (participants insert + delete, messages select + insert, reports insert).
-- They are rebuilt on is_idea_author(), a SECURITY DEFINER boolean: it answers
-- "is the caller this idea's author" and can never hand back the id. The
-- policies on toy_ideas itself (037, 107) keep reading author_id — a policy on
-- its own table needs no column grant. Realtime's postgres_changes on
-- toy_idea_messages runs the rebuilt select policy, unchanged in effect.
--
-- The API reads author_id with the admin client wherever it needs it.
-- Accepted (ruling 2): a thread message's sender_id still identifies the
-- author to the makers who joined.
--
-- DOWN:
--   drop policy if exists "Anyone may join a published challenge" on public.toy_idea_participants;
--   create policy "Anyone may join a published challenge" on public.toy_idea_participants for insert to authenticated
--     with check (profile_id = auth.uid() and not public.has_idea_participant_row(idea_id, auth.uid())
--       and exists (select 1 from public.toy_ideas i where i.id = idea_id and i.status = 'challenge' and i.author_id <> auth.uid()));
--   drop policy if exists "Leave, or be removed by the author" on public.toy_idea_participants;
--   create policy "Leave, or be removed by the author" on public.toy_idea_participants for delete to authenticated
--     using (profile_id = auth.uid() or exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid()));
--   drop policy if exists "Author and participants read the thread" on public.toy_idea_messages;
--   create policy "Author and participants read the thread" on public.toy_idea_messages for select to authenticated
--     using (exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
--       or exists (select 1 from public.toy_idea_participants p where p.idea_id = toy_idea_messages.idea_id
--         and p.profile_id = auth.uid() and p.removed_at is null and toy_idea_messages.created_at >= p.joined_at));
--   drop policy if exists "Author and participants post to the thread" on public.toy_idea_messages;
--   create policy "Author and participants post to the thread" on public.toy_idea_messages for insert to authenticated
--     with check (sender_id = auth.uid() and (exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
--       or exists (select 1 from public.toy_idea_participants p where p.idea_id = toy_idea_messages.idea_id
--         and p.profile_id = auth.uid() and p.removed_at is null)));
--   drop policy if exists "Reporter files a report as the idea's author or a participant" on public.toy_idea_reports;
--   create policy "Reporter files a report as the idea's author or a participant" on public.toy_idea_reports for insert to authenticated
--     with check (reported_by = auth.uid() and (exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
--       or exists (select 1 from public.toy_idea_participants p where p.idea_id = toy_idea_reports.idea_id
--         and p.profile_id = auth.uid() and p.removed_at is null)));
--   drop function if exists public.is_idea_author(uuid);
--   grant select on public.toy_ideas to authenticated;
--   grant select (author_id) on public.toy_ideas to anon;
--   revoke select (anonymous) on public.toy_ideas from anon;
--   alter table public.toy_ideas drop column if exists anonymous;

alter table public.toy_ideas add column anonymous boolean not null default false;

-- anon: 040's fixed list, plus the flag, minus the author.
grant select (anonymous) on public.toy_ideas to anon;
revoke select (author_id) on public.toy_ideas from anon;

-- authenticated: every column but author_id, by name.
revoke select on public.toy_ideas from authenticated;
grant select (
  id, title, summary, description, intended_use, primary_user, contact_prefs, status,
  review_note, tutorial_id, created_at, updated_at, kind, answer_message_id, answered_at,
  photo_path, anonymous
) on public.toy_ideas to authenticated;

create function public.is_idea_author(idea uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.toy_ideas i where i.id = idea and i.author_id = auth.uid())
$$;

revoke execute on function public.is_idea_author(uuid) from public, anon;
grant execute on function public.is_idea_author(uuid) to authenticated;

drop policy "Anyone may join a published challenge" on public.toy_idea_participants;
create policy "Anyone may join a published challenge"
  on public.toy_idea_participants for insert to authenticated
  with check (
    profile_id = auth.uid()
    and not public.has_idea_participant_row(idea_id, auth.uid())
    and exists (select 1 from public.toy_ideas i where i.id = idea_id and i.status = 'challenge')
    and not public.is_idea_author(idea_id)
  );

drop policy "Leave, or be removed by the author" on public.toy_idea_participants;
create policy "Leave, or be removed by the author"
  on public.toy_idea_participants for delete to authenticated
  using (profile_id = auth.uid() or public.is_idea_author(idea_id));

drop policy "Author and participants read the thread" on public.toy_idea_messages;
create policy "Author and participants read the thread"
  on public.toy_idea_messages for select to authenticated
  using (
    public.is_idea_author(idea_id)
    or exists (
      select 1 from public.toy_idea_participants p
      where p.idea_id = toy_idea_messages.idea_id and p.profile_id = auth.uid()
        and p.removed_at is null and toy_idea_messages.created_at >= p.joined_at
    )
  );

drop policy "Author and participants post to the thread" on public.toy_idea_messages;
create policy "Author and participants post to the thread"
  on public.toy_idea_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_idea_author(idea_id)
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_messages.idea_id and p.profile_id = auth.uid() and p.removed_at is null
      )
    )
  );

drop policy "Reporter files a report as the idea's author or a participant" on public.toy_idea_reports;
create policy "Reporter files a report as the idea's author or a participant"
  on public.toy_idea_reports for insert to authenticated
  with check (
    reported_by = auth.uid()
    and (
      public.is_idea_author(idea_id)
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_reports.idea_id and p.profile_id = auth.uid() and p.removed_at is null
      )
    )
  );
