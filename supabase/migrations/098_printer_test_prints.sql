-- 098 — Verified printers, earned rather than granted (printer-verified).
--
-- Decided 2026-09-30: the printer uploads a photo of the SPLAT test print, an
-- admin marks it pass or fail, and 3 completed jobs (VERIFIED_MIN_JOBS in
-- packages/types printing.ts — the integration test holds the two together)
-- follow.
--
--   printer_test_prints  one row per submitted photo. The API reads and writes
--                        it with the service role: an owner submits through
--                        POST /api/printers/:id/test-prints, an admin decides
--                        through /api/admin/test-prints. RLS is on with no
--                        policy, so neither key reaches it directly.
--   photo_path           a storage PATH in the private bucket, never a URL (093's
--                        rule): <printer_id>/<uuid>.<ext>, the only shape the
--                        upload route writes, the extension from the checked
--                        MIME type. The API signs it on read. The service role
--                        writes anywhere, so the CHECK is what holds: a URL, or
--                        another printer's folder, cannot be stored at all.
--   printer-test-prints  private bucket, <printer_id>/<file>. Signed URLs only.
--   verified(printers)   computed field: the latest REVIEWED test print passed
--                        and the printer has 3 completed print jobs. A new
--                        submission waiting for a look does not unverify a
--                        printer that already passed. DEFINER for 095's reason:
--                        invoker RLS hides every job and every test print.
--
-- DOWN:
--   drop function if exists public.verified(public.printers);
--   drop table if exists public.printer_test_prints;
--   (empty the bucket through the Storage API first)
--   delete from storage.buckets where id = 'printer-test-prints';

create table public.printer_test_prints (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers (id) on delete cascade,
  photo_path text not null,
  submitted_at timestamptz not null default now(),
  verdict text check (verdict in ('pass', 'fail')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  note text check (note is null or length(btrim(note)) <= 500),
  constraint printer_test_prints_reviewed check ((verdict is null) = (reviewed_at is null)),
  constraint printer_test_prints_photo_path_check check (
    photo_path ~ ('^' || printer_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$')
  )
);

create index printer_test_prints_printer_idx on public.printer_test_prints (printer_id, submitted_at desc);
-- One waiting at a time: the API's 409, backed here against two racing posts.
create unique index printer_test_prints_one_waiting on public.printer_test_prints (printer_id) where verdict is null;

alter table public.printer_test_prints enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'printer-test-prints', 'printer-test-prints', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create function public.verified(p public.printers)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
      select t.verdict = 'pass'
      from public.printer_test_prints t
      where t.printer_id = p.id and t.verdict is not null
      order by t.reviewed_at desc
      limit 1
    ), false)
    and (
      select count(*)
      from public.toy_transactions x
      where x.printer_id = p.id and x.type = 'print' and x.status = 'completed'
    ) >= 3
$$;
