-- 112 — the photo of the sorted plastic (recycling-photo-upload).
--
-- 063 added recycling_dropoffs.photo_url as "a storage path in the private
-- recycling-photos bucket, never a URL" and made no bucket, policy or writer.
-- This makes all three, and pins the path to the contributor's own folder:
-- <contributor_id>/<uuid>.<ext>, the extension taken from the checked MIME
-- type by POST /api/upload/recycling-photo. The column keeps 063's name.
--
-- 083's delete_account() hands a leaver's drop-offs to the placeholder
-- account. Their photo's folder is still theirs, so the CHECK below would
-- refuse that update and roll the whole deletion back. The trigger clears the
-- photo when the contributor changes; account-deletion.ts empties the folder.
--
-- DOWN:
--   drop trigger if exists recycling_dropoffs_photo_follows_owner on public.recycling_dropoffs;
--   drop function if exists public.recycling_photo_follows_owner();
--   alter table public.recycling_dropoffs drop constraint if exists recycling_dropoffs_photo_is_own_path;
--   drop policy if exists "Contributors upload their own recycling photos" on storage.objects;
--   drop policy if exists "Contributors and leaders read recycling photos" on storage.objects;
--   drop policy if exists "Contributors remove their own recycling photos" on storage.objects;
--   -- the bucket itself only once it is empty:
--   delete from storage.buckets where id = 'recycling-photos';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recycling-photos', 'recycling-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "Contributors upload their own recycling photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recycling-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reads go through the API's signed URLs; this is the second layer under it.
create policy "Contributors and leaders read recycling photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recycling-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.recycling_dropoffs d
        where d.photo_url = name and public.is_org_leader(d.org_id)
      )
    )
  );

create policy "Contributors remove their own recycling photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recycling-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No row holds a photo yet (no writer existed), so this validates at once.
alter table public.recycling_dropoffs
  add constraint recycling_dropoffs_photo_is_own_path check (
    photo_url is null
    or photo_url ~ ('^' || contributor_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$')
  );

create function public.recycling_photo_follows_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contributor_id is distinct from old.contributor_id then
    new.photo_url := null;
  end if;
  return new;
end;
$$;

create trigger recycling_dropoffs_photo_follows_owner
  before update of contributor_id on public.recycling_dropoffs
  for each row execute function public.recycling_photo_follows_owner();
