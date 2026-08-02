-- supabase/migrations/013_notifications.sql
-- WHY: Email notifications were fully designed then declined on 2026-07-29 —
--      the platform stays pull-based. That decision voided the reasoning
--      that had blocked in-app notification badges (decision 6 of
--      2026-07-28-contributor-backing-experience-design.md: "don't build
--      them, real notifications are coming"). This is that surface, in-app
--      only, no email provider involved.
-- HOW: One row per event per recipient, written by API route handlers at the
--      point each event happens — no trigger, no queue, matching how every
--      other cross-table effect in this codebase is done in the handler.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles on delete cascade not null,
  type text not null check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected'
  )),
  tutorial_id uuid references public.tutorials on delete cascade not null,
  -- Denormalised at insert time so a row still reads sensibly if the actor's
  -- name changes later — the same reasoning tutorial_orgs.responded_by is a
  -- foreign key but the badge text is composed at read time from a join that
  -- would break if the row were deleted; here we skip that fragility entirely.
  actor_name text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select using (recipient_id = auth.uid());

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "Admin full access to notifications"
  on public.notifications for all using (public.is_admin());

-- No INSERT policy for ordinary users: every notification is written by API
-- route handlers using the admin client, on behalf of someone other than the
-- caller (you cannot notify yourself that you invited someone).
