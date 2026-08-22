-- 038_toy_idea_collaboration.sql
-- WHY: joining a challenge is self-serve (matching Makers Making Change), and
--      collaboration happens in one thread per challenge.
-- Participants are a table rather than derived from message senders because
-- joining is an explicit act that fires a notification and must be revocable
-- independently of what someone has already written.

create table public.toy_idea_participants (
  idea_id uuid references public.toy_ideas on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (idea_id, profile_id)
);

alter table public.toy_idea_participants enable row level security;

create policy "Participants of public challenges are visible"
  on public.toy_idea_participants for select to anon, authenticated
  using (exists (
    select 1 from public.toy_ideas i
    where i.id = idea_id and i.status in ('challenge', 'graduated')
  ));

-- Self-serve join, but only onto a published challenge. You may not join your
-- own idea (you are already its author) and you may not join something pending.
create policy "Anyone may join a published challenge"
  on public.toy_idea_participants for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.toy_ideas i
      where i.id = idea_id and i.status = 'challenge' and i.author_id <> auth.uid()
    )
  );

-- Leaving is your own call; removing someone is the author's.
create policy "Leave, or be removed by the author"
  on public.toy_idea_participants for delete to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
  );

create policy "Admin full access to idea participants"
  on public.toy_idea_participants for all using (public.is_admin());


-- The thread. Shape copied from toy_transaction_messages (026).
create table public.toy_idea_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas on delete cascade,
  sender_id uuid not null references public.profiles,
  kind text not null default 'user' check (kind in ('system', 'user')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.toy_idea_messages enable row level security;

-- The brief recruits; the conversation does not need an audience. Never anon,
-- even when the challenge itself is public.
create policy "Author and participants read the thread"
  on public.toy_idea_messages for select to authenticated
  using (
    exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
    or exists (
      select 1 from public.toy_idea_participants p
      where p.idea_id = toy_idea_messages.idea_id and p.profile_id = auth.uid()
    )
  );

create policy "Author and participants post to the thread"
  on public.toy_idea_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
      or exists (
        select 1 from public.toy_idea_participants p
        where p.idea_id = toy_idea_messages.idea_id and p.profile_id = auth.uid()
      )
    )
  );

create policy "Admin full access to idea messages"
  on public.toy_idea_messages for all using (public.is_admin());


create index toy_idea_messages_idea_created_idx
  on public.toy_idea_messages (idea_id, created_at);

-- No new policy comes with this. Realtime's postgres_changes runs each
-- subscriber's stream through the table's existing RLS — see 031.
alter publication supabase_realtime add table public.toy_idea_messages;
