-- 093 — community notes on a guide (guide-community-notes).
--
-- A member who built a published guide adds a note against a step, or as a
-- "Missing step"; the guide's contributors pin one as a revision. Pinned
-- revisions show on the guide and in its banner — not in the PDF, which is a
-- file the author uploads.
--
--   step_position  which step, by number. Not a tutorial_steps id: 080's PUT
--                  replaces every step row on each save, so an id would be
--                  set null the first time the author edited. Null, or past
--                  the last step, is "Missing step".
--   author_id      defaults to the Deleted member placeholder (083) and is
--                  set to it when the author's profile goes: their notes stay,
--                  as other authored content does. Inserts always name the
--                  caller (RLS below), so the default is only ever reached
--                  through the delete.
--   pinned_by      set null when that contributor leaves; the API names them
--                  "Deleted member".
--   photo_path     a toy-photos storage PATH, never a URL (the file-column
--                  convention, as 049's): <tutorial_id>/notes/<uuid>.<ext>, the
--                  only shape /api/upload/note-photo writes. The API builds the
--                  public URL on read. A member can insert through PostgREST
--                  with their own JWT, so the CHECK is what holds: a URL, or
--                  another guide's folder, cannot be stored at all.
--   created_at     stamped by a trigger, so a direct insert cannot backdate a
--                  note to sit above the guide's real discussion.
--
-- DOWN:
--   drop table if exists public.tutorial_notes;
--   drop function if exists public.tutorial_notes_stamp();
--   (and restore 077's notifications_type_check)

create table public.tutorial_notes (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  step_position smallint check (step_position between 1 and 60),
  author_id uuid not null default '00000000-0000-4000-8000-00000000dead'
    references public.profiles (id) on delete set default,
  body text not null check (length(btrim(body)) between 1 and 1000),
  photo_path text,
  photo_caption text check (photo_caption is null or length(photo_caption) <= 60),
  pinned_at timestamptz,
  pinned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tutorial_notes_photo_path_check check (
    photo_path is null
    or photo_path ~ ('^' || tutorial_id::text || '/notes/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$')
  )
);

create function public.tutorial_notes_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end $$;
create trigger tutorial_notes_stamp before insert on public.tutorial_notes
  for each row execute function public.tutorial_notes_stamp();
create index tutorial_notes_tutorial_idx on public.tutorial_notes (tutorial_id, created_at);
create index tutorial_notes_author_idx on public.tutorial_notes (author_id);

alter table public.tutorial_notes enable row level security;

create policy tutorial_notes_read on public.tutorial_notes for select
  using (exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved'));
-- As yourself, on a published guide, unpinned: pinning is the API's, after a
-- contributor check, through the service role.
create policy tutorial_notes_insert_own on public.tutorial_notes for insert to authenticated
  with check (
    author_id = auth.uid() and pinned_at is null and pinned_by is null
    and exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );
create policy tutorial_notes_delete_own on public.tutorial_notes for delete to authenticated
  using (author_id = auth.uid());
create policy tutorial_notes_admin on public.tutorial_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 046's guard, again: abort rather than drop a type the live constraint allows.
-- tutorial_noted carries tutorial_id, so 077's notifications_one_subject stands.
do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_type_check' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_type_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in (
     'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
     'collaborator_removed', 'collaborator_left',
     'tutorial_approved', 'tutorial_rejected',
     'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
     'idea_approved', 'idea_rejected',
     'challenge_joined', 'challenge_left', 'challenge_removed',
     'idea_graduated', 'backing_requested', 'tutorial_submitted',
     'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
     'tutorial_thanked',
     'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
     'tutorial_noted'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 093 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated', 'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
    'tutorial_thanked',
    'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
    -- new in 093
    'tutorial_noted'
  ));
