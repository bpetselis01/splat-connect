-- supabase/migrations/058_printers_and_print_jobs.sql
--
-- WHY: brief features 6 and 7. `/dashboard/print-requests` has been a
--      ComingSoon placeholder, `/dashboard/print-requests/[id]` and
--      `/dashboard/printers` do not exist, and nothing in 23 tables models a
--      printer or a print job. The artboard's own notes are the spec: "one
--      status rail, one thread; pickup details appear only at Ready, copied
--      from the printer's profile the moment they accepted — same rule as toy
--      exchanges", and "three tabs: printers, requests, jobs; declining needs a
--      reason, marking ready needs a photo".
--
-- HOW:  two halves, and only one of them is new.
--
--      **The machine is new.** A printer has a bed size, materials loaded, an
--      availability toggle and a capacity, and none of that has anywhere to
--      live. `printers` is that table, owned by a person or an organisation on
--      the same XOR 033 gave toys.
--
--      **The job is not.** A print job is a requester, a giving side, a status
--      machine, a pickup address, two handover codes, a thread and a cost
--      panel. That is `toy_transactions`, exactly as a build was in 057, so the
--      subject becomes a printer plus the files wanted rather than a third copy
--      of all of it.
--
--      As in 057, the extra steps are timestamps rather than status members.
--      `printing` and `ready` as statuses would mean every
--      `status = 'accepted'` predicate in the API silently stops matching a
--      live job — a job on the bed would vanish out of the active list.
--
--      A decline reason IS stored rather than left to the thread. The artboard
--      requires one, and a reason that exists only as a chat message cannot be
--      shown on the list row that needs it.
--
-- DOWN: alter table public.toy_transactions
--         drop constraint toy_transactions_subject,
--         drop constraint toy_transactions_ready_before_collected,
--         drop column decline_reason, drop column ready_photo_url,
--         drop column ready_at, drop column printing_started_at,
--         drop column print_note, drop column printer_id;
--       drop table public.print_job_files;
--       drop table public.printers;
--       (then restore the three-member type check and 057's subject constraint)

-- ---------------------------------------------------------------- printers --

create table public.printers (
  id uuid primary key default gen_random_uuid(),

  -- Mirrors 033's toy ownership: a person's machine or an organisation's, never
  -- both and never neither. A leader acts for the organisation's benches.
  owner_id uuid references public.profiles (id) on delete cascade,
  owner_org_id uuid references public.organizations (id) on delete cascade,
  constraint printers_one_owner check (num_nonnulls(owner_id, owner_org_id) = 1),

  name text not null check (length(btrim(name)) between 1 and 80),

  -- What is actually loaded. Validated in the API rather than by a constraint,
  -- for the reason 037 gives about `contact_prefs`: the set is presentational
  -- and will change more often than the schema should.
  materials text[] not null default '{}',

  -- Millimetres. A part that does not fit the bed cannot be printed, and this
  -- is the fit check the offer screen runs before a leader accepts.
  bed_x integer not null check (bed_x between 1 and 2000),
  bed_y integer not null check (bed_y between 1 and 2000),
  bed_z integer not null check (bed_z between 1 and 2000),

  -- Shown to a requester choosing where to send a job. Suburb and state only:
  -- the street address is the pickup point and is copied onto the job at
  -- accept, exactly as 028 does for a toy handover, so it is never readable
  -- before somebody has agreed to hand something over.
  suburb text,
  state text,

  -- Either closes you. The toggle is the deliberate act; the number is the
  -- honest one, and a machine with three jobs on it is full whatever the
  -- toggle says.
  accepting boolean not null default true,
  capacity integer not null default 1 check (capacity between 0 and 20),

  notes text check (notes is null or length(btrim(notes)) <= 500),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index printers_owner_idx on public.printers (owner_id) where owner_id is not null;
create index printers_org_idx on public.printers (owner_org_id) where owner_org_id is not null;

alter table public.printers enable row level security;

-- A printer is a public offer: somebody has to be able to find it to send a job
-- to it. The columns that are NOT public are the pickup ones, and they are not
-- on this table for exactly that reason.
create policy "Anyone can see a printer that is accepting"
  on public.printers for select to anon, authenticated
  using (true);

create policy "Owners manage their own printers"
  on public.printers for all to authenticated
  using (
    owner_id = auth.uid()
    or (owner_org_id is not null and public.is_org_leader(owner_org_id))
  )
  with check (
    owner_id = auth.uid()
    or (owner_org_id is not null and public.is_org_leader(owner_org_id))
  );

comment on table public.printers is
  'A 3D printer somebody offers to other families. Bed size and materials decide which requests it is offered.';

-- --------------------------------------------------------------- the job --

alter table public.toy_transactions
  -- Which machine the job is on. Named at request time, not at accept: a
  -- requester chooses a printer whose bed fits the part, and "somebody nearby
  -- will pick it up" is the open-pool shape that 033's owner XOR does not allow
  -- (SUPABASE.md, F5).
  add column printer_id uuid references public.printers (id) on delete restrict,
  -- What the requester said. The printer sees this and their suburb, nothing
  -- else about them.
  add column print_note text,
  add column printing_started_at timestamptz,
  add column ready_at timestamptz,
  -- Marking ready needs a photo: the artboard's rule, and the point is that a
  -- requester can see the part came out before they travel for it.
  add column ready_photo_url text,
  -- Stored, not left to the thread. A reason that exists only as a chat message
  -- cannot be rendered on the list row that needs it.
  add column decline_reason text
    check (decline_reason is null or length(btrim(decline_reason)) between 1 and 500);

alter table public.toy_transactions
  drop constraint toy_transactions_type_check;

alter table public.toy_transactions
  add constraint toy_transactions_type_check
  check (type in ('donation', 'exchange', 'build', 'print'));

-- One shape per subject, stated once — extended from 057 rather than replaced
-- in spirit: a toy, a guide plus a brief, or a printer plus the files wanted.
alter table public.toy_transactions
  drop constraint toy_transactions_subject;

alter table public.toy_transactions
  add constraint toy_transactions_subject
  check (
    case
      when type = 'build' then
        toy_id is null
        and offered_toy_id is null
        and tutorial_id is not null
        and build_brief is not null
        and length(btrim(build_brief)) between 1 and 2000
        and printer_id is null
      when type = 'print' then
        toy_id is null
        and offered_toy_id is null
        -- The guide the parts come from. "Parts come from the guide, never
        -- uploaded" is the artboard's rule and the reason there is no upload
        -- path anywhere near this.
        and tutorial_id is not null
        and build_brief is null
        and printer_id is not null
        and working_photo_url is null
        and work_approved_at is null
      else
        toy_id is not null
        and tutorial_id is null
        and build_brief is null
        and printer_id is null
        and working_photo_url is null
        and work_approved_at is null
        and print_note is null
        and printing_started_at is null
        and ready_at is null
        and ready_photo_url is null
    end
  );

-- Ready means a part exists to collect, and the photo is the evidence. Ready
-- with no photo is the state that lets somebody drive across town for nothing.
alter table public.toy_transactions
  add constraint toy_transactions_ready_has_a_photo
  check (ready_at is null or ready_photo_url is not null);

-- It cannot be ready before it started printing. Without this a job can jump
-- the middle of its own rail and the stepper has to guess what happened.
alter table public.toy_transactions
  add constraint toy_transactions_ready_after_printing
  check (ready_at is null or printing_started_at is not null);

create index toy_transactions_printer_idx
  on public.toy_transactions (printer_id)
  where printer_id is not null;

-- ------------------------------------------------------- the files wanted --

-- Rows, not a JSON blob of filenames. "Tick any combination, one request" means
-- the set is the request, and a set that is a blob cannot be joined to the
-- files it names — a renamed or deleted STL would leave the job pointing at a
-- string nobody can resolve.
create table public.print_job_files (
  transaction_id uuid not null references public.toy_transactions (id) on delete cascade,
  stl_file_id uuid not null references public.stl_files (id) on delete restrict,
  quantity integer not null default 1 check (quantity between 1 and 20),
  primary key (transaction_id, stl_file_id)
);

alter table public.print_job_files enable row level security;

-- Same gate as the messages and the costs on the same job.
create policy "Read the files on your own print job"
  on public.print_job_files for select to authenticated
  using (public.is_toy_transaction_party(transaction_id));

create policy "Name the files on your own print job"
  on public.print_job_files for insert to authenticated
  with check (public.is_toy_transaction_party(transaction_id));

create policy "Change the files on your own print job"
  on public.print_job_files for delete to authenticated
  using (public.is_toy_transaction_party(transaction_id));

comment on table public.print_job_files is
  'Which STL files of a guide a print job asks for. Rows rather than a blob, so a job can be joined to the files it names.';

-- ------------------------------------------------------------ the pickup --

-- 033's accept reads an organisation's pickup columns. A print job accepted by
-- a person has always used the person's own address, which is what the existing
-- `p_pickup_*` arguments carry, so nothing changes there.
--
-- What does change: a print job's parties are still the requester and the
-- giving side, so `is_toy_transaction_party()` already answers correctly for
-- every policy above. It is worth stating because it is the reason this
-- migration adds no new RLS function.

-- --------------------------------------------------------- notifications --

do $$
declare
  lost text;
begin
  select string_agg(v, ', ') into lost
  from (
    select (regexp_matches(pg_get_constraintdef(oid), '''([^'']+)''::text', 'g'))[1] as v
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_type_check'
  ) t
  where v not in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated',
    'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved'
  );

  if lost is not null then
    raise exception
      'live notifications_type_check permits values this migration would drop: %. '
      'Add them to the list in 058 before running it.', lost;
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
    'idea_graduated',
    'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved',
    -- new in 058: the two ends of a print job's middle
    'print_started', 'print_ready'
  ));

-- ------------------------------------------------------------ ready shots --

-- Private, and gated like 056's receipts and 057's working shots: the path is
-- <transaction_id>/<file>, so the first folder segment is the job whose parties
-- may read it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-shots', 'print-shots', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "Parties read their own print shots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'print-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties upload their own print shots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'print-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties replace their own print shots"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'print-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );

create policy "Parties remove their own print shots"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'print-shots'
    and public.is_toy_transaction_party(((storage.foldername(name))[1])::uuid)
  );
