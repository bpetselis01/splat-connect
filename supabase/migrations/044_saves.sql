-- 044_saves.sql
-- WHY: My SPLAT's cards promise "saved tutorials", "saved toys" and "saved
--      challenges", and nothing behind them existed. This is that storage.
--
-- One polymorphic table rather than five typed ones. entity_id therefore
-- carries NO foreign key, which is the deliberate trade: a hard delete leaves
-- an orphan row, and no reader ever sees it because the read path joins to the
-- entity through the user client and RLS drops what the caller cannot read.
-- Five tables with real FKs would buy referential integrity for the price of
-- five RLS policy pairs, five handlers and a union query — five copies of a
-- table whose only columns are who, what and when.

create type public.save_entity_type as enum
  ('tutorial', 'toy', 'challenge', 'organisation', 'printable_part');

create table public.saves (
  profile_id  uuid not null references public.profiles on delete cascade,
  entity_type public.save_entity_type not null,
  entity_id   uuid not null,
  created_at  timestamptz not null default now(),
  -- The composite primary key does three jobs at once: uniqueness, an
  -- idempotent insert via on-conflict, and a direct index hit for "is this one
  -- saved". No surrogate id — nothing ever references a save row.
  primary key (profile_id, entity_type, entity_id)
);

alter table public.saves enable row level security;

create policy "Read your own saves"
  on public.saves for select to authenticated
  using (profile_id = auth.uid());

create policy "Save as yourself"
  on public.saves for insert to authenticated
  with check (profile_id = auth.uid());

create policy "Unsave your own"
  on public.saves for delete to authenticated
  using (profile_id = auth.uid());

-- No admin policy, deliberately, and not an oversight. 041_toy_idea_reports
-- granted admins full access because a report is something an admin acts on; a
-- bookmark is not. A permissive RLS policy set is OR'd together, and with none
-- defined for a role every select by that role returns zero rows regardless of
-- what 004's default privileges grant it.

-- The primary key already serves "is this one saved". This serves the
-- newest-first list, which is the only other read shape.
create index saves_recent_idx
  on public.saves (profile_id, entity_type, created_at desc);
