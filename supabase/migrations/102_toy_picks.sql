-- 102 — "Also worth a look" on a toy: the holder chooses how.
--
-- Decided 2026-09-30 (registry: toy-holder-picks): the holder picks the mode
-- and can change it — automatic (their other listed toys, newest first, which
-- is what the web page did) or hand-picked, up to three, like 048's guide
-- recommendations. A pick is one of the holder's own toys or a published guide.
--
--   toys.picks_mode  'auto' | 'picked'.
--   toy_picks        (toy_id, position 1–3, entity_type, entity_id). Position
--                    1..3 plus the (toy_id, position) key IS the three-cap,
--                    as in 048. entity_id has no foreign key because it points
--                    at one of two tables; the public read drops any pick that
--                    is not public, so a dangling one shows nothing.
--
-- RLS in 048's shape: read while the toy is publicly listed, or by its holder;
-- the holder (owner, or a leader of the owning org) writes; admins do anything.
-- The API checks that every pick is the holder's own toy or an approved guide.
-- The confirm handler resets both when the toy changes hands.
--
-- DOWN:
--   drop table if exists public.toy_picks;
--   alter table public.toys drop column if exists picks_mode;

alter table public.toys
  add column picks_mode text not null default 'auto' check (picks_mode in ('auto', 'picked'));

create table public.toy_picks (
  toy_id      uuid not null references public.toys on delete cascade,
  position    smallint not null check (position between 1 and 3),
  entity_type text not null check (entity_type in ('toy', 'tutorial')),
  entity_id   uuid not null,
  primary key (toy_id, position),
  unique (toy_id, entity_type, entity_id),
  check (not (entity_type = 'toy' and entity_id = toy_id))
);

alter table public.toy_picks enable row level security;

create policy "Anyone can read picks of a listed toy, holders their own"
  on public.toy_picks for select using (
    exists (
      select 1 from public.toys t
      where t.id = toy_id
        and ((t.status = 'published' and t.retired_at is null)
             or t.owner_id = auth.uid()
             or public.is_org_leader(t.owner_org_id))
    )
  );

create policy "Holders write their toy's picks"
  on public.toy_picks for all
  using (
    exists (
      select 1 from public.toys t
      where t.id = toy_id and (t.owner_id = auth.uid() or public.is_org_leader(t.owner_org_id))
    )
  )
  with check (
    exists (
      select 1 from public.toys t
      where t.id = toy_id and (t.owner_id = auth.uid() or public.is_org_leader(t.owner_org_id))
    )
  );

create policy "Admin full access to toy_picks"
  on public.toy_picks for all using (public.is_admin());
