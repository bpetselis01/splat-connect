-- 037_toy_ideas.sql
-- WHY: /get-involved/submit-an-idea was marked live but captured nothing. This
--      is the storage behind it, and the record a public Design Challenge is.
-- Field set follows Makers Making Change's published idea form; see the spec.

create table public.toy_ideas (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles on delete cascade,
  title text not null,
  summary text not null,
  description text not null,
  intended_use text not null,
  primary_user text not null,
  -- How involved the author wants to be, declared upfront so a maker knows
  -- before joining whether there is a person to collaborate with or just a brief.
  -- Values validated in the API, not by a constraint: the set is presentational
  -- and will change more often than the schema should.
  contact_prefs text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'challenge', 'rejected', 'graduated')),
  -- Shown to the author on rejection. A rejection with no reason is the thing
  -- that stops people submitting again. Never shown publicly.
  review_note text,
  tutorial_id uuid references public.tutorials on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.toy_ideas enable row level security;

-- Only reviewed ideas are public. A pending idea describes a specific disabled
-- child's functional needs before anyone has checked it for identifying detail,
-- so it must not be readable by anon under any circumstance.
create policy "Published challenges are public"
  on public.toy_ideas for select to anon, authenticated
  using (status in ('challenge', 'graduated'));

create policy "Authors see their own ideas at any status"
  on public.toy_ideas for select to authenticated
  using (author_id = auth.uid());

create policy "Authors submit their own ideas"
  on public.toy_ideas for insert to authenticated
  with check (author_id = auth.uid());

-- Editing stops at review. A rejected idea is resubmitted, not amended, so the
-- thing an admin read is the thing that was judged.
create policy "Authors edit only before review"
  on public.toy_ideas for update to authenticated
  using (author_id = auth.uid() and status = 'pending')
  with check (author_id = auth.uid() and status = 'pending');

create policy "Admin full access to toy ideas"
  on public.toy_ideas for all using (public.is_admin());

grant select on public.toy_ideas to anon, authenticated;
grant insert, update on public.toy_ideas to authenticated;

create index toy_ideas_status_created_idx on public.toy_ideas (status, created_at desc);
create index toy_ideas_author_idx on public.toy_ideas (author_id);
